import { addDays, format } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { getCallerSession, hasRole, unauthorized, forbidden } from "@/lib/api-auth";
import openai, { MODEL } from "@/lib/openai";
import type { Employee, Shift } from "@/lib/types";
import { getCachedWeather } from "@/lib/supabase";

type GenerateScheduleOpenAIRequest = {
  prompt: string;
  weekStart: string;
  employees: Employee[];
  existingShifts: Shift[];
  locationId?: string;
};

type GeneratedShift = {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  date: string;
  startTime: string;
  endTime: string;
  role: "grill" | "counter" | "manager" | "cashier" | "cleaner";
  shiftType: "morning" | "lunch" | "evening" | "short" | "split";
  hoursCount: number;
  createdByAi: true;
  reasoning: string;
};

type GeneratedDeletion = {
  shiftId: string;
  employeeId?: string;
  employeeName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
};

type GeneratedSummary = {
  totalShifts: number;
  totalHours: number;
  estimatedCostSEK: number;
  employeeHours: Array<{
    employeeId: string;
    name: string;
    hoursThisWeek: number;
    maxHours: number;
  }>;
  coverageByDay: Array<{
    date: string;
    day: string;
    staffCount: number;
    hasManager: boolean;
  }>;
};

type GenerateScheduleOpenAIResponse = {
  language: string;
  explanation: string;
  warnings: string[];
  insights: string[];
  shifts: GeneratedShift[];
  deletions?: GeneratedDeletion[];
  summary: GeneratedSummary;
  weatherUsed?: boolean;
  weekStart?: string;
};

type UsageInfo = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

const SYSTEM_PROMPT = `
You are an expert restaurant scheduling assistant for Mister York,
a popular burger restaurant in Gothenburg, Sweden.

You have deep knowledge of:
- Swedish labor law (Arbetstidslagen):
  * Minimum 11 hours rest between shifts
  * Maximum 10 hours per shift
  * Maximum 48 hours per week
- Restaurant peak hours: Lunch 11:00-14:00, Dinner 17:00-21:00
- Minimum staffing: 2 staff during peaks, 1 manager always on duty
- Roles: grill, counter, manager, cashier, cleaner

SCHEDULING RULES:
- Never exceed an employee's max_weekly_hours
- Always schedule at least 1 manager per open day
- Lunch peak: 1 grill + 1 counter minimum
- Dinner peak: 1 grill + 1 counter + 1 cashier minimum
- Distribute hours fairly unless manager specifies otherwise
- If "fully booked" or "busy" — add extra grill and counter
- Part-time employees default max = their contract_hours
- If manager asks to remove/cancel a person from shifts, use deletions with existing shift IDs

SHIFT TEMPLATES:
- Morning: 07:00-15:00 (8h)
- Lunch: 10:00-18:00 (8h)
- Evening: 14:00-22:00 (8h)
- Short lunch: 11:00-15:00 (4h)
- Short evening: 17:00-21:00 (4h)

WEATHER AWARENESS:
When weather forecast data is provided, always factor it into your scheduling:
- Sunny weekend → add 2-3 extra staff
- Hot day (>22°C) → add 1-2 extra staff, note cold drink stock
- Rainy day → consider reducing 1 staff, note delivery packaging
- Severe weather → reduce staffing, flag potential no-shows
- Always mention weather impact in your explanation field
- If no weather data provided → schedule based on historical patterns only

You must respond with valid JSON only. No extra text.
Use this exact structure:
{
  "language": "en or sv — match the manager's input language",
  "explanation": "2-3 sentence summary of scheduling decisions",
  "warnings": ["any constraint violations or flags"],
  "insights": ["proactive tips for the manager"],
  "deletions": [
    {
      "shiftId": "existing-shift-id",
      "employeeName": "string",
      "reason": "one sentence why this shift was removed"
    }
  ],
  "shifts": [
    {
      "employeeId": "uuid",
      "employeeName": "string",
      "employeeRole": "string",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "role": "grill|counter|manager|cashier|cleaner",
      "shiftType": "morning|lunch|evening|short|split",
      "hoursCount": number,
      "createdByAi": true,
      "reasoning": "one sentence why this person was chosen"
    }
  ],
  "summary": {
    "totalShifts": number,
    "totalHours": number,
    "estimatedCostSEK": number,
    "employeeHours": [
      {
        "employeeId": "uuid",
        "name": "string",
        "hoursThisWeek": number,
        "maxHours": number
      }
    ],
    "coverageByDay": [
      {
        "date": "YYYY-MM-DD",
        "day": "Monday",
        "staffCount": number,
        "hasManager": boolean
      }
    ]
  }
}
`.trim();

function getShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  if (
    Number.isNaN(startH) ||
    Number.isNaN(startM) ||
    Number.isNaN(endH) ||
    Number.isNaN(endM)
  ) {
    return 0;
  }
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (endMinutes <= startMinutes) return 0;
  return (endMinutes - startMinutes) / 60;
}

function buildHoursAlreadyScheduled(
  existingShifts: Shift[],
): Record<string, number> {
  return existingShifts.reduce<Record<string, number>>((acc, shift) => {
    const hours = getShiftHours(shift.startTime, shift.endTime);
    acc[shift.employeeId] = (acc[shift.employeeId] ?? 0) + hours;
    return acc;
  }, {});
}

function getBilingualMessage(en: string, sv: string) {
  return { en, sv };
}

function getOpenAIStatusCode(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return 500;
}

function validateGeneratedResponse(
  parsed: GenerateScheduleOpenAIResponse,
  employees: Employee[],
  existingShifts: Shift[],
  weekStart: string,
): string | null {
  const shifts = Array.isArray(parsed.shifts) ? parsed.shifts : [];
  const deletions = Array.isArray(parsed.deletions) ? parsed.deletions : [];
  if (shifts.length === 0 && deletions.length === 0) {
    return "AI returned 0 actions. Try a more specific prompt with days, staff count, and shift times.";
  }

  const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
  const employeeMap = new Map(
    employees.map((employee) => [employee.id, employee]),
  );
  const existingShiftMap = new Map(existingShifts.map((shift) => [shift.id, shift]));

  for (const [index, shift] of shifts.entries()) {
    if (
      !shift ||
      typeof shift.employeeId !== "string" ||
      typeof shift.date !== "string" ||
      typeof shift.startTime !== "string" ||
      typeof shift.endTime !== "string" ||
      typeof shift.role !== "string"
    ) {
      return `Invalid shift at index ${index}. Required fields: employeeId, date, startTime, endTime, role.`;
    }

    if (shift.date < weekStart || shift.date > weekEnd) {
      return `Invalid shift date ${shift.date}. All shift dates must be within ${weekStart} to ${weekEnd}.`;
    }

    if (!employeeMap.has(shift.employeeId)) {
      return `Invalid employeeId ${shift.employeeId}. Shift references an employee not present in request data.`;
    }
  }

  for (const [index, deletion] of deletions.entries()) {
    if (!deletion || typeof deletion.shiftId !== "string") {
      return `Invalid deletion at index ${index}. Required fields: shiftId.`;
    }
    if (!existingShiftMap.has(deletion.shiftId)) {
      return `Invalid deletion shiftId ${deletion.shiftId}. Shift does not exist in current week.`;
    }
  }

  const hoursByEmployee = new Map<string, number>();
  for (const shift of existingShifts) {
    hoursByEmployee.set(
      shift.employeeId,
      (hoursByEmployee.get(shift.employeeId) ?? 0) +
        getShiftHours(shift.startTime, shift.endTime),
    );
  }
  for (const deletion of deletions) {
    const existing = existingShiftMap.get(deletion.shiftId);
    if (!existing) continue;
    hoursByEmployee.set(
      existing.employeeId,
      (hoursByEmployee.get(existing.employeeId) ?? 0) -
        getShiftHours(existing.startTime, existing.endTime),
    );
  }
  for (const shift of shifts) {
    hoursByEmployee.set(
      shift.employeeId,
      (hoursByEmployee.get(shift.employeeId) ?? 0) +
        getShiftHours(shift.startTime, shift.endTime),
    );
  }

  for (const employee of employees) {
    const totalHours = hoursByEmployee.get(employee.id) ?? 0;
    if (totalHours > employee.maxWeeklyHours) {
      return `${employee.name} exceeds maxWeeklyHours (${totalHours.toFixed(1)}h > ${employee.maxWeeklyHours}h).`;
    }
  }

  return null;
}

export async function POST(req: Request) {
  const caller = await getCallerSession(req as NextRequest);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "admin", "super_admin")) return forbidden();

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "OpenAI API key not configured. Add OPENAI_API_KEY to .env.local",
      },
      { status: 500 },
    );
  }

  try {
    const body = (await req.json()) as Partial<GenerateScheduleOpenAIRequest>;

    if (
      !body ||
      typeof body.prompt !== "string" ||
      typeof body.weekStart !== "string" ||
      !Array.isArray(body.employees) ||
      !Array.isArray(body.existingShifts)
    ) {
      return NextResponse.json(
        {
          error: getBilingualMessage(
            "Bad request. Expected { prompt, weekStart, employees, existingShifts }.",
            "Felaktig förfrågan. Förväntat { prompt, weekStart, employees, existingShifts }.",
          ),
        },
        { status: 400 },
      );
    }

    const { prompt, weekStart, employees, existingShifts, locationId } = body;

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
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekForecasts = forecasts.filter((f) => {
          const d = new Date(f.forecastDate);
          return d >= new Date(weekStart) && d <= weekEnd;
        });

        // If no forecasts for this specific week use all available forecasts
        const relevantForecasts =
          weekForecasts.length > 0
            ? weekForecasts
            : forecasts.slice(0, 7);

        // Build weather context string
        weatherContext = `GOTHENBURG WEATHER FORECAST FOR THIS WEEK:
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

Use this weather data to adjust staffing recommendations. On sunny weekends add extra staff. On rainy days consider reducing staff.`;
      } catch (error) {
        // Weather fetch failed — continue without weather context
        console.warn(
          "[generate-schedule-openai] Weather context unavailable:",
          error,
        );
        weatherContext = "";
      }
    }

    const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
    const hoursAlreadyScheduled = buildHoursAlreadyScheduled(existingShifts);

    const employeesText = employees
      .map(
        (e) => `
- ${e.name} | Role: ${e.role} | Max: ${e.maxWeeklyHours}h/week |
  Scheduled so far: ${hoursAlreadyScheduled[e.id] || 0}h |
  Type: ${e.employmentType} | Rate: ${e.hourlyRate ?? 0} SEK/h`,
      )
      .join("");

    const existingShiftsText =
      existingShifts.length > 0
        ? existingShifts
            .map(
              (s) =>
                `${s.id} | ${s.date}: ${s.employeeName} ${s.startTime}-${s.endTime}`,
            )
            .join("\n")
        : "None yet — build from scratch";

    const response = await (openai as any).chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `
EMPLOYEES AVAILABLE:
${employeesText}

WEEK: ${weekStart} to ${weekEnd}

EXISTING SHIFTS:
${existingShiftsText}

${weatherContext ? `${weatherContext}\n\n` : ""}MANAGER REQUEST:
${prompt}
`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        {
          error: getBilingualMessage(
            "OpenAI returned an empty response.",
            "OpenAI returnerade ett tomt svar.",
          ),
        },
        { status: 500 },
      );
    }

    let parsed: GenerateScheduleOpenAIResponse;
    try {
      parsed = JSON.parse(content) as GenerateScheduleOpenAIResponse;
    } catch {
      return NextResponse.json(
        {
          error: getBilingualMessage(
            "Failed to parse AI response as JSON.",
            "Kunde inte tolka AI-svaret som JSON.",
          ),
        },
        { status: 500 },
      );
    }

    const validationError = validateGeneratedResponse(
      parsed,
      employees,
      existingShifts,
      weekStart,
    );
    if (validationError) {
      return NextResponse.json(
        {
          error: validationError,
          errorSv: `Valideringsfel i AI-svar: ${validationError}`,
        },
        { status: 400 },
      );
    }

    const normalizedDeletions = Array.isArray(parsed.deletions)
      ? parsed.deletions.filter(
          (deletion): deletion is GeneratedDeletion =>
            Boolean(deletion && typeof deletion.shiftId === "string"),
        )
      : [];

    const usage: UsageInfo = {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
      estimatedCostUsd: Number(
        (
          ((response.usage?.prompt_tokens ?? 0) / 1_000_000) * 2.5 +
          ((response.usage?.completion_tokens ?? 0) / 1_000_000) * 10
        ).toFixed(6),
      ),
    };

    return NextResponse.json({
      ...parsed,
      deletions: normalizedDeletions,
      usage,
      weatherUsed: weatherContext.length > 0,
      weekStart,
    });
  } catch (error) {
    const statusCode = getOpenAIStatusCode(error);
    const message =
      error instanceof Error ? error.message : "Unknown server error.";

    if (statusCode === 429) {
      return NextResponse.json(
        {
          error: "Too many requests. Please wait 30 seconds and try again.",
          errorSv:
            "För många förfrågningar. Vänta 30 sekunder och försök igen.",
          details: message,
        },
        { status: 429 },
      );
    }

    if (statusCode === 400) {
      return NextResponse.json(
        {
          error: getBilingualMessage(
            "Invalid request sent to OpenAI.",
            "Ogiltig begäran skickades till OpenAI.",
          ),
          details: message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: getBilingualMessage(
          "Server error while generating schedule.",
          "Serverfel vid generering av schema.",
        ),
        details: message,
      },
      { status: 500 },
    );
  }
}
