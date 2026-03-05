import { NextResponse } from "next/server";

type EmployeeInput = {
  id: string;
  name: string;
  role: string;
  maxWeeklyHours: number;
  contractHours?: number;
  currentScheduledHours?: number;
};

type ShiftInput = {
  employeeId: string;
  employeeName?: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
};

type RequestBody = {
  prompt: string;
  employees: EmployeeInput[];
  existingShifts: ShiftInput[];
  weekStart: string;
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

Roles available: grill, counter, manager, cashier, cleaner
Typical shift times: Morning 07:00-15:00, Lunch 10:00-18:00, Evening 14:00-22:00, Split 11:00-15:00+17:00-21:00

You will receive:
- List of employees with their roles, max hours, and current scheduled hours
- The manager's natural language request
- Any existing shifts for the week

Respond ONLY with valid JSON in this exact format:
{
  "explanation": "Brief explanation of scheduling decisions in the same language the manager used",
  "warnings": ["Any constraint violations or things to flag"],
  "shifts": [
    {
      "employeeId": "uuid",
      "employeeName": "Name",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "role": "grill|counter|manager|cashier|cleaner",
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

    const userPayload = {
      weekStart: body.weekStart,
      managerPrompt: body.prompt,
      managerLanguageHint: detectPromptLanguage(body.prompt),
      employees: body.employees,
      existingShifts: Array.isArray(body.existingShifts) ? body.existingShifts : [],
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2200,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: JSON.stringify(userPayload),
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

    return NextResponse.json({
      explanation,
      warnings,
      shifts,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
