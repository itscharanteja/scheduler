import { NextRequest, NextResponse } from "next/server";
import { getCachedWeather } from "@/lib/supabase";
import { getCallerSession, hasRole, unauthorized, forbidden, resolveLocationId } from "@/lib/api-auth";
import {
  anonymiseEmployees,
  anonymiseShifts,
  deAnonymiseResponse,
} from "@/lib/gdpr";
import { validateSchedule } from "@/lib/labour-law";

type EmployeeInput = {
  id: string;
  name: string;
  role: string;
  maxWeeklyHours: number;
  contractHours?: number;
  currentScheduledHours?: number;
};

type ShiftInput = {
  id?: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
};

type ShiftDeletion = {
  shiftId: string;
  employeeId?: string;
  employeeName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
};

type RequestBody = {
  prompt: string;
  employees: EmployeeInput[];
  existingShifts: ShiftInput[];
  weekStart: string;
  locationId?: string;
};

function detectPromptLanguage(prompt: string): "sv" | "en" {
  const lowered = prompt.toLowerCase();
  if (/[åäö]/.test(lowered)) return "sv";
  if (
    /(schemalägg|vecka|lördag|deltid|timmar|bemanning|övertid|anställd)/.test(
      lowered
    )
  ) {
    return "sv";
  }
  return "en";
}

const SYSTEM_PROMPT = `
You are a scheduling assistant for Skift.

You help managers create weekly staff schedules. You must:
1. Respect each employee's max weekly hours from their contract
2. Ensure every shift has at least 1 manager on duty
3. Ensure minimum 2 staff during lunch (11:00-14:00) and dinner (17:00-21:00) peaks
4. Follow Swedish labor law: minimum 11 hours rest between shifts, max 10h per shift
5. Distribute hours fairly unless the manager specifies otherwise

Roles available: service, shiftleader, rutin, sales, reception
Typical shift times: Morning 07:00-15:00, Lunch 10:00-18:00, Evening 14:00-22:00, Split 11:00-15:00+17:00-21:00

WEATHER AWARENESS:
When weather forecast data is provided, always factor it into your scheduling:
- Sunny weekend → add 2-3 extra staff
- Hot day (>22°C) → add 1-2 extra staff, note cold drink stock
- Rainy day → consider reducing 1 staff, note delivery packaging
- Severe weather → reduce staffing, flag potential no-shows
- Always mention weather impact in your explanation field
- If no weather data provided → schedule based on historical patterns only

You will receive:
- List of employees with their roles, max hours, and current scheduled hours
- The manager's natural language request
- Any existing shifts for the week (with IDs)
- Weather forecast for Gothenburg (if available)
- If manager asks to remove/cancel someone's assigned shifts, return those shifts in deletions

IMPORTANT: For each shift you generate, set "employeeId" to the EXACT "id" value from the employees list provided to you. Do NOT invent or generate new UUIDs. Copy the id character-for-character.

Respond ONLY with valid JSON in this exact format:
{
  "explanation": "Brief explanation of scheduling decisions in the same language the manager used",
  "warnings": ["Any constraint violations or things to flag"],
  "deletions": [
    {
      "shiftId": "existing-shift-id",
      "employeeName": "Name",
      "reason": "Why this shift is removed"
    }
  ],
  "shifts": [
    {
      "employeeId": "<exact id from employees list>",
      "employeeName": "Name",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "role": "service|shiftleader|rutin|sales|reception",
      "createdByAi": true
    }
  ]
}
`.trim();

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object.");
  }
  return raw.slice(start, end + 1);
}

export async function POST(req: Request) {
  const caller = await getCallerSession(req as NextRequest);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing ANTHROPIC_API_KEY." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Partial<RequestBody>;
    if (!body.prompt || !Array.isArray(body.employees) || !body.weekStart) {
      return NextResponse.json(
        { error: "Invalid payload. Expected { prompt, employees, existingShifts, weekStart }." },
        { status: 400 }
      );
    }

    const locationId = resolveLocationId(caller, body.locationId);

    // GDPR — anonymise before sending to Claude
    const { anonymised: anonEmployees, mapping } = anonymiseEmployees(
      body.employees,
    );
    const anonShifts = anonymiseShifts(
      Array.isArray(body.existingShifts) ? body.existingShifts : [],
      mapping,
    );

    console.log(
      `[GDPR] Anonymised ${body.employees.length} employees. Real names never sent to Claude.`,
    );

    // Fetch weather context
    let weatherContext = "";

    if (locationId) {
      try {
        // Try to get cached weather first
        let forecasts = await getCachedWeather(locationId);

        // If no cached data use mock weather
        if (!forecasts || forecasts.length === 0) {
          const { getMockWeather } = await import("@/lib/weather");
          const mockData = getMockWeather();
          forecasts = mockData.map((f) => ({
            ...f,
            id: crypto.randomUUID(),
            locationId,
            fetchedAt: new Date().toISOString(),
          }));
        }

        // Filter to only the relevant week
        const weekEnd = new Date(body.weekStart!);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekForecasts = forecasts.filter((f) => {
          const d = new Date(f.forecastDate);
          return (
            d >= new Date(body.weekStart!) && d <= weekEnd
          );
        });

        // If no forecasts for this specific week use all available forecasts
        const relevantForecasts =
          weekForecasts.length > 0
            ? weekForecasts
            : forecasts.slice(0, 7);

        // Build weather context string
        weatherContext = `
GOTHENBURG WEATHER FORECAST FOR THIS WEEK:
${relevantForecasts
  .map(
    (f) =>
      `${f.day} ${f.forecastDate}: ${f.condition}, High ${f.temperatureHigh}°C / Low ${f.temperatureLow}°C, Rain probability: ${f.rainProbability}%, Wind: ${f.windSpeed}m/s
  Staffing note: ${f.staffingSuggestion}${
        f.inventorySuggestion
          ? `\n  Inventory note: ${f.inventorySuggestion}`
          : ""
      }`,
  )
  .join("\n")}

Use this weather data to adjust staffing recommendations. On sunny weekends add extra staff. On rainy days consider reducing staff. Always mention weather impact in your explanation.`;
      } catch (error) {
        // Weather fetch failed — continue without weather context
        console.warn("[generate-schedule] Weather context unavailable:", error);
        weatherContext = "";
      }
    }

    const userPayload = {
      weekStart: body.weekStart,
      managerPrompt: body.prompt,
      managerLanguageHint: detectPromptLanguage(body.prompt),
      employees: anonEmployees,
      existingShifts: anonShifts,
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              ...userPayload,
              weatherContext: weatherContext || "",
            }),
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errorText = await anthropicRes.text();
      return NextResponse.json(
        { error: `Anthropic API error (${anthropicRes.status}): ${errorText}` },
        { status: 502 }
      );
    }

    const raw = await anthropicRes.json();
    const textBlocks = Array.isArray(raw?.content)
      ? raw.content
          .filter((block: { type?: string }) => block?.type === "text")
          .map((block: { text?: string }) => block.text ?? "")
      : [];
    const text = textBlocks.join("\n").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Anthropic returned an empty response." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(extractJsonObject(text)) as {
      explanation?: unknown;
      warnings?: unknown;
      deletions?: unknown;
      shifts?: unknown;
    };

    const explanation =
      typeof parsed.explanation === "string" ? parsed.explanation : "";
    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w): w is string => typeof w === "string")
      : [];
    const shifts = Array.isArray(parsed.shifts)
      ? parsed.shifts
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const shift = s as Record<string, unknown>;
            const employeeId =
              typeof shift.employeeId === "string" ? shift.employeeId : "";
            const employeeName =
              typeof shift.employeeName === "string" ? shift.employeeName : "";
            const date = typeof shift.date === "string" ? shift.date : "";
            const startTime =
              typeof shift.startTime === "string" ? shift.startTime : "";
            const endTime = typeof shift.endTime === "string" ? shift.endTime : "";
            const role = typeof shift.role === "string" ? shift.role : "";

            if (!employeeId || !date || !startTime || !endTime || !role) {
              return null;
            }

            return {
              employeeId,
              employeeName,
              date,
              startTime,
              endTime,
              role,
              createdByAi: true,
            };
          })
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
      : [];

    const deletions = Array.isArray(parsed.deletions)
      ? parsed.deletions
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const deletion = item as Record<string, unknown>;
            const shiftId =
              typeof deletion.shiftId === "string" ? deletion.shiftId : "";
            if (!shiftId) return null;
            return {
              shiftId,
              employeeId:
                typeof deletion.employeeId === "string"
                  ? deletion.employeeId
                  : undefined,
              employeeName:
                typeof deletion.employeeName === "string"
                  ? deletion.employeeName
                  : undefined,
              date: typeof deletion.date === "string" ? deletion.date : undefined,
              startTime:
                typeof deletion.startTime === "string"
                  ? deletion.startTime
                  : undefined,
              endTime:
                typeof deletion.endTime === "string" ? deletion.endTime : undefined,
              reason:
                typeof deletion.reason === "string" ? deletion.reason : undefined,
            } as ShiftDeletion;
          })
          .filter((d): d is ShiftDeletion => Boolean(d))
      : [];

    // GDPR — re-attach real names
    const deAnonymised = deAnonymiseResponse(
      {
        explanation,
        warnings,
        deletions,
        shifts,
      },
      mapping,
    );

    // Swedish labor law validation
    const validation = validateSchedule(
      deAnonymised.shifts,
      body.employees, // use real employees with contracts
    );

    console.log(
      `[LABOUR LAW] Validation complete. ${validation.criticalCount} critical, ${validation.warningCount} warnings.`,
    );

    // Merge validation results into response
    const lawWarnings = validation.violations
      .filter((v) => v.severity === "critical")
      .map((v) => `⚠️ ${v.description}`);

    const lawInsights = validation.violations
      .filter((v) => v.severity === "warning")
      .map((v) => `💡 ${v.description}`);

    // Prepend law warnings to existing warnings
    const mergedWarnings = [...lawWarnings, ...(deAnonymised.warnings || [])];

    // Prepend law insights to existing insights
    const mergedInsights = [...lawInsights];

    return NextResponse.json({
      explanation: deAnonymised.explanation,
      warnings: mergedWarnings,
      insights: mergedInsights,
      deletions: deAnonymised.deletions,
      shifts: deAnonymised.shifts,
      weatherUsed: weatherContext.length > 0,
      weekStart: body.weekStart,
      labourLaw: {
        isValid: validation.isValid,
        criticalCount: validation.criticalCount,
        warningCount: validation.warningCount,
        summary: validation.summary,
        violations: validation.violations,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
