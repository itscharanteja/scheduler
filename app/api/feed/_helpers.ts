import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function makeAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export type CallerInfo = { id: string; role: string; fullName: string };

export async function getCallerInfo(req: NextRequest): Promise<CallerInfo | null> {
  if (!SERVICE_ROLE_KEY) return null;

  const userClient = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  const adminClient = makeAdminClient();
  const { data } = await adminClient
    .from("user_profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  const row = data as { id: string; role: string; full_name: string | null };
  return { id: row.id, role: row.role, fullName: row.full_name ?? "Unknown" };
}

export function isAdminRole(role: string) {
  return role === "admin" || role === "super_admin";
}

type DbPost = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  repost_of: string | null;
  is_deleted: boolean;
  created_at: string;
  // user_profiles joined; employees nested to get the real display name
  user_profiles: { full_name: string | null; employees: { name: string } | null } | null;
};

export type MappedPost = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  repostOfId: string | null;
  isDeleted: boolean;
  createdAt: string;
};

/** Prefer employees.name over user_profiles.full_name (full_name may be an email). */
export function resolveDisplayName(
  profile: { full_name: string | null; employees: { name: string } | null } | null
): string {
  return profile?.employees?.name ?? profile?.full_name ?? "Unknown";
}

export function mapPost(row: DbPost): MappedPost {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: resolveDisplayName(row.user_profiles),
    content: row.content,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    linkTitle: row.link_title,
    repostOfId: row.repost_of,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}
