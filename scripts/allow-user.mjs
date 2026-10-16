import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Read .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        env[key] = val;
      }
    }
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const [emailArg, roleArg, nameArg] = process.argv.slice(2);

  if (!emailArg) {
    console.log("Usage: node scripts/allow-user.mjs <email> [role] [fullName]");
    console.log("Roles: user (default), user_lead, admin, super_admin");
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const role = roleArg && ["super_admin", "admin", "user_lead", "user"].includes(roleArg) ? roleArg : "user";
  const fullName = nameArg || null;

  const { data, error } = await supabase
    .from("allowed_users")
    .upsert({ email, role, full_name: fullName });

  if (error) {
    console.error("Failed to add allowed user:", error.message);
    process.exit(1);
  }

  console.log(`\n✅ Email '${email}' is now allowed to sign up with role '${role}'.`);
}

main();
