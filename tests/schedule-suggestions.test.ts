import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import nodeModule, { type ResolveHook } from "node:module";
import test from "node:test";
import type { CallerSession } from "../lib/api-auth";
import type { StaffingSuggestion, SuggestionAssignment } from "../lib/schedule-suggestions";
import type { SelectedDayForecast } from "../lib/weather";

// Node's TypeScript runner needs explicit extensions for the app's bundler-style imports.
const { registerHooks } = nodeModule as typeof nodeModule & {
  registerHooks(options: { resolve: ResolveHook }): { deregister(): void };
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    const path = specifier.startsWith("@/")
      ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url)
      : specifier.startsWith(".") && context.parentURL
        ? new URL(`${specifier}.ts`, context.parentURL)
        : null;
    return nextResolve(path && existsSync(path) ? path.href : specifier, context);
  },
});
const { createScheduleSuggestionService, handleScheduleSuggestionRequest } = await import("../lib/server/schedule-suggestions");
const { fetchSelectedDayForecast, ForecastLookupError } = await import("../lib/weather");
const { LOCATION_ID } = await import("../lib/constants");
const { POST } = await import("../app/api/schedule/suggestions/route");
hooks.deregister();

const date = "2026-11-11";
const previous = "2026-11-10";
const otherBranch = "33333333-3333-4333-8333-333333333333";
const caller: CallerSession = { role: "admin", userId: "admin", employeeId: "employee", locationId: LOCATION_ID };
const role = { leader: "shiftleader", team: "service", rutin: "rutin" };

function shift(id: string, role: string, startTime = "08:00", endTime = "16:00", day = date): SuggestionAssignment {
  return { id, employeeId: `private-employee-${id}`, role, date: day, startTime, endTime, status: "draft" };
}

const base = [shift("leader", role.leader), shift("team1", role.team), shift("team2", role.team)];
const morningShort = [
  shift("short1", role.team, "10:00", "15:00"),
  shift("short2", role.team, "10:00", "15:00"),
  shift("rutin", role.rutin, "10:00", "15:00"),
];

function forecast(condition = "Clear"): SelectedDayForecast {
  const fetched = new Date();
  return {
    provider: "openweather", date, fetchedAt: fetched.toISOString(),
    expiresAt: new Date(fetched.getTime() + 60_000).toISOString(),
    entries: [{ time: `${date}T12:00:00.000Z`, condition, daylight: true }],
  };
}

type Providers = NonNullable<Parameters<typeof createScheduleSuggestionService>[0]>;

function harness(assignments: SuggestionAssignment[], options: Providers = {}) {
  const calls = { forecast: 0, model: 0, roster: 0 };
  const service = createScheduleSuggestionService({
    forecast: async (...args) => {
      calls.forecast++;
      return options.forecast ? options.forecast(...args) : forecast();
    },
    explain: async (input, fetcher) => {
      calls.model++;
      assert.doesNotMatch(JSON.stringify(input), /private-employee|employeeId|notes/);
      return options.explain ? options.explain(input, fetcher)
        : input.windows.map((_, window) => ({ window, emphasis: "coverage" }));
    },
  });
  const suggest = (date: string, location: string, language: "en" | "sv" = "en") =>
    service(date, location, language, async () => {
      calls.roster++;
      return assignments;
    });
  return { calls, suggest };
}

async function windowAt(run: ReturnType<typeof harness>, startTime: string, location = LOCATION_ID) {
  const result = await run.suggest(date, location);
  assert.equal(result.status, "ready");
  const window = result.suggestions.find((window) => window.startTime === startTime);
  assert.ok(window, `missing window at ${startTime}`);
  return window;
}

function request(payload: unknown) {
  return new Request("http://localhost/api/schedule/suggestions", {
    method: "POST", body: JSON.stringify(payload),
  });
}

test("returns empty for a selected day in a staffed week without calling either provider", async () => {
  const { suggest, calls } = harness([
    shift("yesterday", role.team, "17:00", "00:00", previous),
    shift("tomorrow", role.leader, "08:00", "16:00", "2026-11-12"),
  ]);
  const response = await handleScheduleSuggestionRequest(request({ date, locationId: LOCATION_ID }), async () => caller, suggest);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual({ status: result.status, date: result.date, locationId: result.locationId },
    { status: "empty", date, locationId: LOCATION_ID });
  assert.match(result.rosterRevision, /^[a-f0-9]{64}$/);
  assert.deepEqual(calls, { forecast: 0, model: 0, roster: 1 });
});

test("rejects unauthorized callers, unauthorized branches, and invalid dates before reading the roster", async () => {
  const { suggest, calls } = harness(base);
  for (const [session, body, status] of [
    [null, { date, locationId: LOCATION_ID }, 401],
    [{ ...caller, role: "user_lead" }, { date, locationId: LOCATION_ID }, 403],
    [caller, { date, locationId: otherBranch }, 403],
    [caller, { date: "2026-02-30", locationId: LOCATION_ID }, 400],
    [caller, { date, locationId: 12 }, 400],
  ] as const) {
    const response = await handleScheduleSuggestionRequest(request(body), async () => session, suggest);
    assert.equal(response.status, status);
  }
  assert.deepEqual(calls, { forecast: 0, model: 0, roster: 0 });
});

test("POST requires a real session", async () => {
  const { NextRequest } = await import("next/server.js");
  const response = await POST(new NextRequest(request({ date, locationId: LOCATION_ID })));
  assert.equal(response.status, 401);
});

test("distinguishes a failed schedule read from a confirmed empty day", async () => {
  const suggest = createScheduleSuggestionService({
    forecast: async () => assert.fail("forecast should be skipped"),
    explain: async () => assert.fail("model should be skipped"),
  });
  const result = await suggest(date, LOCATION_ID, "en", async () => { throw new Error("timeout"); });
  assert.deepEqual(result, { status: "unavailable", source: "schedule", retryable: true, date, locationId: LOCATION_ID, rosterRevision: null });
});

test("skips the model for failed, missing, stale, or mismatched forecast facts", async () => {
  for (const [lookup, retryable] of [
    [async () => { throw new ForecastLookupError(true); }, true],
    [async () => null, false],
    [async () => ({ ...forecast(), expiresAt: "2000-01-01T00:00:00.000Z" }), false],
    [async () => ({ ...forecast(), date: previous }), false],
  ] as const) {
    const { calls, suggest } = harness(base, { forecast: lookup });
    const result = await suggest(date, LOCATION_ID);
    assert.equal(result.status, "unavailable");
    assert.equal(result.source, "forecast");
    assert.equal(result.retryable, retryable);
    assert.equal(calls.model, 0);
  }
  const unsupported = harness(base);
  const result = await unsupported.suggest(date, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.status, "unavailable");
  assert.equal(result.source, "forecast");
  assert.equal(unsupported.calls.forecast, 0);
});

test("applies the combined sunny target and counts published and draft assignments", async () => {
  const roster = [...base, ...morningShort.slice(1)];
  roster[0] = { ...roster[0], status: "published" };
  const add = await windowAt(harness(roster), "10:00");
  assert.deepEqual([add.action, add.count, add.scheduledHeadcount, add.endTime], ["add", 1, 5, "15:00"]);
  assert.match(add.rationale, /1 team member/);
  const keep = await windowAt(harness([...base, ...morningShort]), "10:00");
  assert.deepEqual([keep.action, keep.count, keep.scheduledHeadcount], ["keep", undefined, 6]);
});

test("rain lowers the combined short-shift target by one team member", async () => {
  const run = harness([...base, ...morningShort], { forecast: async () => forecast("Rain") });
  const reduction = await windowAt(run, "10:00");
  assert.deepEqual([reduction.action, reduction.count, reduction.scheduledHeadcount], ["reduce", 1, 6]);
  assert.equal((await windowAt(run, "08:00")).action, "keep");

  const evening = [
    shift("evening-leader", role.leader, "16:00", "00:00"),
    shift("evening-team1", role.team, "16:00", "00:00"),
    shift("evening-team2", role.team, "16:00", "00:00"),
    ...[1, 2, 3].map((index) => shift(`evening-short${index}`, role.team, "17:00", "21:00")),
    shift("evening-rutin", role.rutin, "17:00", "21:00"),
  ];
  assert.equal((await windowAt(harness(evening), "17:00")).action, "keep");
  const eveningRain = await windowAt(harness(evening, { forecast: async () => forecast("Rain") }), "17:00");
  assert.deepEqual([eveningRain.action, eveningRain.count, eveningRain.scheduledHeadcount], ["reduce", 1, 7]);
  assert.equal((await windowAt(harness(evening), "21:00")).endTime, "00:00");
});

test("does not reduce if the assignment is needed during another part of the shift", async () => {
  const handoff = [
    shift("leader", role.leader, "08:00", "16:00"),
    shift("team-long", role.team, "07:00", "16:00"),
    shift("team-early", role.team, "07:00", "10:00"),
    shift("team-late", role.team, "07:00", "16:00"),
  ];
  assert.equal((await windowAt(harness(handoff), "08:00")).action, "review");
});

test("protects minimum roles, counts distinct people, and keeps rutin separate", async () => {
  const leader = shift("leader", role.leader, "08:00", "10:00");
  const duplicateRole = { ...leader, id: "duplicate", role: role.team };
  const assignments = [leader, duplicateRole, shift("rutin", role.rutin, "08:00", "10:00")];
  const advice = await windowAt(harness(assignments), "08:00");
  assert.deepEqual([advice.action, advice.count, advice.scheduledHeadcount], ["add", 2, 2]);
  assert.match(advice.rationale, /Minimum coverage/);
  assert.match(advice.rationale, /2 team members/);
});

test("covers role handoffs and detects a gap between assignment changes", async () => {
  const roster = [
    shift("leader1", role.leader, "08:00", "09:00"),
    shift("leader2", role.leader, "09:15", "10:00"),
    shift("team1", role.team, "08:00", "10:00"),
    shift("team2", role.team, "08:00", "10:00"),
  ];
  const run = harness(roster);
  assert.equal((await windowAt(run, "08:00")).action, "keep");
  const gap = await windowAt(run, "09:00");
  assert.deepEqual([gap.action, gap.count, gap.endTime], ["add", 1, "09:15"]);
  assert.match(gap.rationale, /1 shift leader/);
  assert.equal((await windowAt(run, "09:15")).action, "keep");
});

test("uses qualitative guidance for unknown targets and clips overnight carry-in", async () => {
  const run = harness([
    shift("overnight-leader", role.leader, "22:00", "02:00", previous),
    shift("overnight-team", role.team, "22:00", "03:00", previous),
    shift("day", role.team, "18:00", "01:00"),
  ]);
  const result = await run.suggest(date, otherBranch);
  assert.equal(result.status, "ready");
  const summary = (window: StaffingSuggestion) => [window.startTime, window.endTime, window.scheduledHeadcount, window.action, window.count];
  assert.deepEqual(result.suggestions.map(summary).sort(), [
    ["00:00", "02:00", 2, "review", undefined],
    ["02:00", "03:00", 1, "review", undefined],
    ["18:00", "00:00", 1, "review", undefined],
  ]);
  assert.match(result.suggestions.find((item) => item.startTime === "02:00")!.rationale, /Minimum coverage/);
});

test("rejects invalid model actions, unknown windows, and unsupported weather emphasis", async () => {
  for (const explain of [
    async (input: Parameters<NonNullable<Providers["explain"]>>[0]) =>
      input.windows.map((_, window) => ({ window, emphasis: "coverage", action: "reduce" })),
    async (input: Parameters<NonNullable<Providers["explain"]>>[0]) =>
      input.windows.map((_, window) => ({ window: window + 1, emphasis: "coverage" })),
    async (input: Parameters<NonNullable<Providers["explain"]>>[0]) =>
      input.windows.map((_, window) => ({ window, emphasis: "demand" })),
  ]) {
    const result = await harness(base, { explain, forecast: async () => forecast("Clouds") }).suggest(date, LOCATION_ID);
    assert.equal(result.status, "unavailable");
    assert.equal(result.source, "model");
    assert.equal(result.retryable, true);
  }
});

test("coalesces identical roster revisions across languages", async () => {
  const run = harness(base, {
    explain: async ({ windows }) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return windows.map((_, window) => ({ window, emphasis: "demand" }));
    },
  });
  const [english, swedish] = await Promise.all([run.suggest(date, LOCATION_ID), run.suggest(date, LOCATION_ID, "sv")]);
  assert.equal(english.status, "ready");
  assert.equal(swedish.status, "ready");
  assert.equal(english.rosterRevision, swedish.rosterRevision);
  assert.match(english.suggestions[0].rationale, /Sunny conditions/);
  assert.match(swedish.suggestions[0].rationale, /Soligt väder/);
  assert.equal(run.calls.forecast, 1);
  assert.equal(run.calls.model, 1);
});

test("discards advice if a saved assignment changes while the model runs", async () => {
  const roster = [...base];
  const run = harness(roster, {
    explain: async ({ windows }) => {
      roster.push(shift("late-edit", role.team));
      return windows.map((_, window) => ({ window, emphasis: "coverage" }));
    },
  });
  const result = await run.suggest(date, LOCATION_ID);
  assert.equal(result.status, "unavailable");
  assert.equal(result.source, "schedule");
  assert.equal(result.retryable, true);
});

test("weather lookup uses real timestamps and the branch local date", async (t) => {
  const key = process.env.OPENWEATHER_API_KEY;
  process.env.OPENWEATHER_API_KEY = "stub";
  t.after(() => {
    if (key === undefined) delete process.env.OPENWEATHER_API_KEY;
    else process.env.OPENWEATHER_API_KEY = key;
  });
  const location = { latitude: 57.747372, longitude: 11.993070, timeZone: "Europe/Stockholm" };
  const now = new Date("2026-11-10T18:00:00Z");
  let requests = 0;
  const fetcher: typeof fetch = async (url) => {
    requests++;
    assert.equal(new URL(String(url)).searchParams.get("lat"), "57.747372");
    const entry = (time: string, main: string) => ({ dt: Date.parse(time) / 1000, weather: [{ main }] });
    return Response.json({ list: [
      entry("2026-11-10T21:00:00Z", "Clear"),
      entry("2026-11-10T23:00:00Z", "Rain"),
      entry("2026-11-11T23:00:00Z", "Clouds"),
    ] });
  };
  const facts = await fetchSelectedDayForecast(date, location, fetcher, now);
  assert.deepEqual(facts?.entries, [{ condition: "Rain", daylight: false, time: "2026-11-10T23:00:00.000Z" }]);
  assert.equal(await fetchSelectedDayForecast("2026-11-14", location, fetcher, now), null);
  assert.equal(await fetchSelectedDayForecast("2026-11-09", location, fetcher, now), null);
  assert.equal(requests, 2);
});

test("uses the provider adapters and validates the structured explanation", async (t) => {
  const savedKeys = {
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
  process.env.OPENWEATHER_API_KEY = "stub-weather";
  process.env.ANTHROPIC_API_KEY = "stub-model";
  t.after(() => {
    for (const [key, value] of Object.entries(savedKeys)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const forecastTime = new Date(Date.now() + 3 * 3_600_000);
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(forecastTime);
  const calls = t.mock.method(globalThis, "fetch", async (input: URL | string, init: RequestInit) => {
    const url = new URL(input);
    assert.ok(init.signal);
    if (url.hostname === "api.openweathermap.org") {
      return Response.json({ list: [{
        dt: Math.floor(forecastTime.getTime() / 1000), weather: [{ main: "Clear" }], sys: { pod: "d" },
      }] });
    }
    assert.equal(url.hostname, "api.anthropic.com");
    const body = JSON.parse(String(init.body));
    assert.equal(body.output_config.format.type, "json_schema");
    const facts = JSON.parse(body.messages[0].content);
    assert.equal(facts.weather, "sunny");
    assert.doesNotMatch(body.messages[0].content, /private-employee/);
    return Response.json({ content: [{ type: "text", text: JSON.stringify({
      explanations: facts.windows.map((_: unknown, window: number) => ({ window, emphasis: "demand" })),
    }) }] });
  });
  const suggest = createScheduleSuggestionService();
  const result = await suggest(date, LOCATION_ID, "en", async () => base.map((assignment) => ({ ...assignment, date })));
  assert.equal(result.status, "ready");
  assert.equal(calls.mock.callCount(), 2);
});
