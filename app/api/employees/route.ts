/*
  GET /api/employees?hasAccount=true
  Returns employees. With hasAccount=true, only those linked to a user_profiles row.
*/

import { NextRequest, NextResponse } from "next/server";
import { getEmployees } from "@/lib/supabase";
import { supabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const hasAccount = request.nextUrl.searchParams.get("hasAccount") === "true";
    const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;

    if (hasAccount && supabaseClient) {
      // Fetch employee_ids that have a user_profiles row
      const { data: profiles, error } = await supabaseClient
        .from("user_profiles")
        .select("employee_id")
        .not("employee_id", "is", null);

      if (error) throw error;

      const accountEmployeeIds = new Set(
        (profiles as { employee_id: string }[]).map((p) => p.employee_id)
      );

      const all = await getEmployees(locationId);
      const employees = all.filter((e) => accountEmployeeIds.has(e.id));
      return NextResponse.json({ employees });
    }

    const employees = await getEmployees(locationId);
    return NextResponse.json({ employees });
  } catch (error) {
    console.error("[api/employees]", error);
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}
