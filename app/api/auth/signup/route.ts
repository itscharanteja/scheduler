import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return NextResponse.json(
      { error: "Database authentication is not configured on this server." },
      { status: 503 }
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password, name } = body;

  if (!email?.trim() || !password?.trim() || !name?.trim()) {
    return NextResponse.json(
      { error: "Full name, email, and password are required." },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Verify if the email is pre-approved in allowed_users
  const { data: allowed, error: checkError } = await adminClient
    .from("allowed_users")
    .select("email, role, full_name")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (checkError) {
    console.error("[signup checkError]", checkError);
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Not accepted. Contact developer" },
      { status: 403 }
    );
  }

  // 2. Create user with email auto-confirmed
  const assignedName = name.trim() || allowed.full_name || normalizedEmail.split("@")[0];
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: password.trim(),
    email_confirm: true,
    user_metadata: { full_name: assignedName },
  });

  if (authError || !authData?.user) {
    if (authError?.message?.toLowerCase().includes("already registered")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }
    console.error("[signup createUser error]", authError);
    return NextResponse.json(
      { error: authError?.message || "Failed to create account" },
      { status: 500 }
    );
  }

  const userId = authData.user.id;
  const assignedRole = allowed.role || "user";

  // 3. Upsert into user_profiles with pre-assigned role
  const { error: profileError } = await adminClient
    .from("user_profiles")
    .upsert({
      id: userId,
      email: normalizedEmail,
      role: assignedRole,
      full_name: assignedName,
    });

  if (profileError) {
    console.error("[signup user_profiles upsert error]", profileError);
  }

  return NextResponse.json(
    {
      success: true,
      message: "Account created successfully! You can now sign in.",
    },
    { status: 201 }
  );
}
