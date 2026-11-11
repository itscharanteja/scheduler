import { fetchAnthropicMessage, SCHEDULING_MODEL } from "./anthropic";
import { hasRole, resolveLocationId, type CallerSession } from "../api-auth";
import { LOCATION_ID } from "../constants";
import {
  assignmentBounds, DAY_SECONDS, isScheduleDate, overlappingAssignments, scheduleRosterRevision,
  type ScheduleSuggestionResult, type StaffingSuggestion, type SuggestionAssignment,
} from "../schedule-suggestions";
import {
  ForecastLookupError, fetchSelectedDayForecast, type SelectedDayForecast, type VerifiedForecastLocation,
} from "../weather";

const MIDNIGHT = DAY_SECONDS;
const HOUR = 3600;
const GAMLA_ULLEVI_ID = "33333333-3333-4333-8333-333333333333";
const FORECAST_LOCATIONS = new Map<string, VerifiedForecastLocation>([
  // https://www.q8truck.com/sv/stations/q8truck-hisings-backa-se0826
  [LOCATION_ID, { latitude: 57.747372, longitude: 11.993070, timeZone: "Europe/Stockholm" }],
  // https://results.cupmanager.net/661795%2C2026/arena/719058/info
  [GAMLA_ULLEVI_ID, { latitude: 57.7065, longitude: 11.97902, timeZone: "Europe/Stockholm" }],
]);

const ROLES = ["shiftleader", "service", "rutin"] as const;
type Role = typeof ROLES[number];
type Target = Record<Role, number>;
type Weather = "sunny" | "rainy" | "other";
type Assignment = SuggestionAssignment & { start: number; end: number };
type PolicyWindow = { start: number; end: number; target?: Target };
type Advice = Omit<StaffingSuggestion, "rationale"> & {
  roleCounts: Target;
  target?: Target;
  missingMinimum: Role[];
  missingTarget: Role[];
};
type Language = "en" | "sv";

const MINIMUM: Target = { shiftleader: 1, service: 1, rutin: 0 };
const BASE: Target = { shiftleader: 1, service: 2, rutin: 0 };

function staffingPolicy(locationId: string, weather: Weather): PolicyWindow[] {
  if (locationId !== LOCATION_ID) return [];
  const shortShift = (extraService: number): Target | undefined => {
    if (weather === "other") return undefined;
    return { ...BASE, service: BASE.service + extraService - Number(weather === "rainy"), rutin: 1 };
  };
  return [
    { start: 8 * HOUR, end: 10 * HOUR, target: BASE },
    { start: 10 * HOUR, end: 15 * HOUR, target: shortShift(2) },
    { start: 15 * HOUR, end: 16 * HOUR, target: BASE },
    { start: 16 * HOUR, end: 17 * HOUR, target: BASE },
    { start: 17 * HOUR, end: 21 * HOUR, target: shortShift(3) },
    { start: 21 * HOUR, end: MIDNIGHT, target: BASE },
  ];
}

function weatherCategory({ entries }: SelectedDayForecast): Weather {
  if (entries.some(({ condition }) => condition === "Rain" || condition === "Drizzle")) return "rainy";
  const daylight = entries.filter((entry) => entry.daylight);
  if (daylight.length && daylight.every(({ condition }) => condition === "Clear")) return "sunny";
  return "other";
}

function employeesOnDuty(assignments: Assignment[]) {
  const employees = new Map<string, Set<string>>();
  for (const { employeeId, role } of assignments) {
    const roles = employees.get(employeeId) ?? new Set<string>();
    roles.add(role);
    employees.set(employeeId, roles);
  }
  return employees;
}

/** Match each required slot to a different employee, even with conflicting duplicate assignments. */
function missingRoles(employees: ReturnType<typeof employeesOnDuty>, target: Target): Role[] {
  const matched = new Map<string, Role>();
  function fill(role: Role, visited: Set<string>): boolean {
    for (const [id, roles] of employees) {
      if (!roles.has(role) || visited.has(id)) continue;
      visited.add(id);
      const previous = matched.get(id);
      if (previous && !fill(previous, visited)) continue;
      matched.set(id, role);
      return true;
    }
    return false;
  }

  const missing: Role[] = [];
  for (const role of ROLES) {
    for (let slot = 0; slot < target[role]; slot++) {
      if (!fill(role, new Set())) missing.push(role);
    }
  }
  return missing;
}

function clockLabel(seconds: number) {
  const time = new Date((seconds % MIDNIGHT) * 1000).toISOString();
  return Number.isInteger(seconds / 60) ? time.slice(11, 16) : time.slice(11, 23).replace(/\.?0+$/, "");
}

function calculateAdvice(assignments: SuggestionAssignment[], date: string, policy: PolicyWindow[]): Advice[] {
  const roster = assignments.map((assignment) => ({ ...assignment, ...assignmentBounds(assignment, date) }));
  const points = new Set(policy.flatMap(({ start, end }) => [start, end]));
  for (const { start, end } of roster) {
    points.add(Math.max(0, start));
    points.add(Math.min(end, MIDNIGHT));
  }
  const boundaries = [...points].sort((a, b) => a - b);
  const intervals = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    return {
      start, end,
      policy: policy.find((window) => window.start <= start && window.end >= end),
      active: roster.filter((assignment) => assignment.start < end && assignment.end > start),
    };
  }).filter(({ policy, active }) => policy || active.length);

  // Each proposed removal must cover the displayed window and leave every interval
  // of that assignment adequately staffed. Leave overnight cuts for manual review.
  const proposedRemovals: Assignment[] = [];
  return intervals.map(({ start, end, active, policy }) => {
    const employees = employeesOnDuty(active);
    const roles = [...employees.values()];
    const roleCounts = {
      shiftleader: roles.filter((set) => set.has("shiftleader")).length,
      service: roles.filter((set) => set.has("service")).length,
      rutin: roles.filter((set) => set.has("rutin")).length,
    };
    const target = policy?.target;
    const scheduledHeadcount = employees.size;
    const missingMinimum = missingRoles(employees, MINIMUM);
    const missingTarget = target ? missingRoles(employees, target) : [];
    let action: Advice["action"] = "review";
    let count: number | undefined;

    if (target) {
      if (missingTarget.length) {
        action = "add";
        count = missingTarget.length;
      } else if (scheduledHeadcount === target.shiftleader + target.service + target.rutin) {
        action = "keep";
      } else {
        const removable = active.find((candidate) => {
          if (candidate.start < 0 || candidate.end > MIDNIGHT) return false;
          // Avoid repeating or stacking recommendations for overlapping removals.
          if (proposedRemovals.some((other) => other.start < candidate.end && other.end > candidate.start)) return false;
          if (active.some((other) => other !== candidate && other.employeeId === candidate.employeeId)) return false;
          return intervals.every((interval) => {
            if (!interval.active.includes(candidate)) return true;
            const applicable = interval.policy?.target;
            if (!applicable) return false;
            const remaining = employeesOnDuty(interval.active.filter((assignment) => assignment !== candidate));
            return missingRoles(remaining, applicable).length === 0 && missingRoles(remaining, MINIMUM).length === 0;
          });
        });
        if (removable) {
          proposedRemovals.push(removable);
          action = "reduce";
          count = 1;
        }
      }
    }

    return {
      startTime: clockLabel(start), endTime: clockLabel(end), scheduledHeadcount,
      action, count, roleCounts, target, missingMinimum, missingTarget,
    };
  });
}

type ModelInput = {
  date: string;
  weather: Weather;
  forecast: SelectedDayForecast["entries"];
  windows: Advice[];
};

async function prioritizeAdvice(input: ModelInput, fetcher: typeof fetch): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new ModelLookupError(false);
  const response = await fetchAnthropicMessage(apiKey, {
    model: SCHEDULING_MODEL,
    max_tokens: 800,
    thinking: { type: "disabled" },
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            explanations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  window: { type: "integer" },
                  emphasis: { type: "string", enum: ["coverage", "demand"] },
                },
                required: ["window", "emphasis"],
                additionalProperties: false,
              },
            },
          },
          required: ["explanations"],
          additionalProperties: false,
        },
      },
    },
    system: [
      "Prioritize these approved staffing windows for a schedule editor, emphasizing minimum coverage gaps.",
      "List every zero-based window index exactly once, most important first.",
      'Choose emphasis "demand" only if the daily sunny or rainy outlook helps explain this window. Otherwise use "coverage".',
      "The client will render the approved action, counts and explanation from these selections.",
    ].join(" "),
    messages: [{ role: "user", content: JSON.stringify(input) }],
  }, AbortSignal.timeout(10_000), fetcher);
  if (!response.ok) throw new ModelLookupError(response.status === 429 || response.status >= 500);
  const body = await response.json();
  const output = body.content?.find((block: { type: string }) => block.type === "text")?.text;
  if (typeof output !== "string" || output.length > 4000) throw new ModelLookupError(true);
  return JSON.parse(output)?.explanations;
}

class ModelLookupError extends Error {
  readonly retryable: boolean;

  constructor(retryable: boolean) {
    super("Model unavailable");
    this.retryable = retryable;
  }
}

function rationale(advice: Advice, weather: Weather, demand: boolean, language: Language) {
  const sv = language === "sv";
  const names = sv
    ? { shiftleader: "passledare", service: "teammedlem", rutin: "rutin" }
    : { shiftleader: "shift leader", service: "team member", rutin: "rutin" };
  const list = new Intl.ListFormat(language, { type: "conjunction" });
  const slots = (roles: Role[]) => list.format(ROLES.flatMap((role) => {
    const count = roles.filter((item) => item === role).length;
    const name = count > 1 && role !== "rutin"
      ? sv ? (role === "service" ? "teammedlemmar" : names[role]) : names[role] + "s"
      : names[role];
    return count ? [`${count} ${name}`] : [];
  }));

  const gaps = advice.missingMinimum.length
    ? sv ? `Minimibemanningen saknar ${slots(advice.missingMinimum)}.`
      : `Minimum coverage is missing ${slots(advice.missingMinimum)}.`
    : "";
  let reason: string;
  switch (advice.action) {
    case "add":
      reason = sv ? `Bemanningsmålet kräver ytterligare ${slots(advice.missingTarget)}.`
        : `The staffing target requires ${slots(advice.missingTarget)} more.`;
      break;
    case "reduce":
      reason = sv ? "Ett pass kan tas bort samtidigt som bemanningsmålet och de obligatoriska rollerna täcks under hela passet."
        : "One assignment can be removed while meeting the staffing target and required roles throughout that shift.";
      break;
    case "keep":
      reason = sv ? "Bemanningen uppfyller målet och täcker de obligatoriska rollerna."
        : "Scheduled coverage meets the staffing target and covers the required roles.";
      break;
    case "review":
      reason = advice.target
        ? sv ? "Granska täckningen under hela passet innan du minskar bemanningen."
          : "Review coverage across the full shift before reducing staffing."
        : sv ? "Det saknas ett bemanningsmål för tidsintervallet. Granska täckningen."
          : "Review coverage for this window. A staffing target is unavailable.";
  }
  const outlook = weather === "sunny"
    ? sv ? "Soligt väder under dagen kan locka fler spontanbesök." : "Sunny conditions in the daily forecast may bring more walk-ins."
    : sv ? "Regn i dagsprognosen kan ge färre spontanbesök." : "Rain in the daily forecast may mean fewer walk-ins.";
  const weatherContext = weather === "other" ? "" : outlook;
  return [gaps, ...(demand ? [weatherContext, reason] : [reason, weatherContext])].filter(Boolean).join(" ");
}

function validateExplanation(input: ModelInput, output: unknown) {
  if (!Array.isArray(output) || output.length !== input.windows.length) throw new ModelLookupError(true);

  const used = new Set<number>();
  return output.map((item) => {
    const { window, emphasis } = item ?? {};
    if (Object.keys(item ?? {}).length !== 2 || !Number.isInteger(window) || used.has(window) ||
      !input.windows[window] || (emphasis !== "coverage" && (emphasis !== "demand" || input.weather === "other"))) {
      throw new ModelLookupError(true);
    }
    used.add(window);
    return { advice: input.windows[window], demand: emphasis === "demand" };
  });
}

type LoadRoster = (locationId: string, date: string) => Promise<SuggestionAssignment[]>;

type Dependencies = {
  forecast?: typeof fetchSelectedDayForecast;
  explain?: typeof prioritizeAdvice;
};

type AdviceResult =
  | Exclude<ScheduleSuggestionResult, { status: "ready" }>
  | (Omit<Extract<ScheduleSuggestionResult, { status: "ready" }>, "suggestions"> & {
      weather: Weather;
      explanations: ReturnType<typeof validateExplanation>;
    });

export class ScheduleLocationError extends Error {}

export function createScheduleSuggestionService({
  forecast = fetchSelectedDayForecast, explain = prioritizeAdvice,
}: Dependencies = {}) {
  const inFlight = new Map<string, Promise<AdviceResult>>();

  return async function suggest(
    date: string, locationId: string, language: Language, load: LoadRoster,
  ): Promise<ScheduleSuggestionResult> {
    const started = Date.now();
    let forecastCalls = 0;
    let modelCalls = 0;
    const selection = { date, locationId };
    const unavailable = (source: "schedule" | "forecast" | "model", retryable: boolean, rosterRevision: string | null = null) =>
      ({ ...selection, status: "unavailable" as const, source, retryable, rosterRevision });
    const finish = (result: AdviceResult): ScheduleSuggestionResult => {
      console.info("[schedule-suggestions]", {
        outcome: result.status, source: result.status === "unavailable" ? result.source : undefined,
        forecastCalls, modelCalls, elapsedMs: Date.now() - started,
      });
      if (result.status !== "ready") return result;
      const { explanations, weather, ...ready } = result;
      return {
        ...ready,
        suggestions: explanations.map(({ advice, demand }) => ({
          startTime: advice.startTime, endTime: advice.endTime, scheduledHeadcount: advice.scheduledHeadcount,
          action: advice.action, count: advice.count, rationale: rationale(advice, weather, demand, language),
        })),
      };
    };

    let assignments: SuggestionAssignment[];
    let rosterRevision: string;
    try {
      assignments = overlappingAssignments(await load(locationId, date), date);
      rosterRevision = await scheduleRosterRevision(assignments);
    } catch (error) {
      return finish(unavailable("schedule", !(error instanceof ScheduleLocationError)));
    }
    if (!assignments.length) return finish({ ...selection, status: "empty", rosterRevision });
    const location = FORECAST_LOCATIONS.get(locationId);
    if (!location) return finish(unavailable("forecast", false, rosterRevision));

    const key = JSON.stringify([locationId, date, rosterRevision]);
    const existing = inFlight.get(key);
    if (existing) return finish(await existing);
    const pending = (async (): Promise<AdviceResult> => {
      let facts: SelectedDayForecast | null;
      try {
        facts = await forecast(date, location, (...args) => {
          forecastCalls++;
          return fetch(...args);
        });
      } catch (error) {
        return unavailable("forecast", !(error instanceof ForecastLookupError) || error.retryable, rosterRevision);
      }
      if (facts?.provider !== "openweather" || facts.date !== date || !facts.entries.length ||
        !(Date.parse(facts.expiresAt) > Date.now())) {
        return unavailable("forecast", false, rosterRevision);
      }
      const weather = weatherCategory(facts);
      const windows = calculateAdvice(assignments, date, staffingPolicy(locationId, weather))
        .sort((a, b) => b.missingMinimum.length - a.missingMinimum.length || b.missingTarget.length - a.missingTarget.length);
      const input = { date, weather, forecast: facts.entries, windows: windows.slice(0, 12) };
      let explanations: ReturnType<typeof validateExplanation>;
      try {
        explanations = validateExplanation(input, await explain(input, (...args) => {
          modelCalls++;
          return fetch(...args);
        }));
      } catch (error) {
        return unavailable("model", !(error instanceof ModelLookupError) || error.retryable, rosterRevision);
      }

      try {
        const latest = overlappingAssignments(await load(locationId, date), date);
        const latestRevision = await scheduleRosterRevision(latest);
        if (latestRevision !== rosterRevision) {
          console.info("[schedule-suggestions] discarded stale roster");
          if (!latest.length) return { ...selection, status: "empty", rosterRevision: latestRevision };
          return unavailable("schedule", true, latestRevision);
        }
      } catch {
        return unavailable("schedule", true, rosterRevision);
      }
      return { ...selection, status: "ready", rosterRevision, forecastTime: facts.fetchedAt, expiresAt: facts.expiresAt, weather, explanations };
    })();

    inFlight.set(key, pending);
    try {
      return finish(await pending);
    } finally {
      inFlight.delete(key);
    }
  };
}

export async function handleScheduleSuggestionRequest(
  request: Request,
  authenticate: () => Promise<CallerSession | null>,
  suggest: (date: string, locationId: string, language: Language) => Promise<ScheduleSuggestionResult>,
) {
  const caller = await authenticate();
  if (!caller) return Response.json({ error: "Unauthorised" }, { status: 401 });
  if (!hasRole(caller, "admin", "super_admin")) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const date: unknown = body?.date;
  const requested: unknown = body?.locationId;
  if (!isScheduleDate(date) || typeof requested !== "string" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requested)) {
    return Response.json({ error: "A valid date and locationId are required" }, { status: 400 });
  }
  const locationId = resolveLocationId(caller, requested.toLowerCase());
  if (!locationId || locationId !== requested.toLowerCase()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const language = request.headers.get("accept-language")?.toLowerCase().startsWith("sv") ? "sv" : "en";
  return Response.json(await suggest(date, locationId, language), { headers: { "Cache-Control": "no-store" } });
}
