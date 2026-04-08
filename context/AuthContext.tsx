"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabaseClient } from "@/lib/supabase";

export type UserRole = "super_admin" | "admin" | "user_lead" | "user";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  employeeId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Returns true if the current user has ANY of the given roles.
   *  Always returns true when Supabase is not configured (dev bypass). */
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(
  userId: string,
  email: string
): Promise<AuthUser | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("user_profiles")
    .select("role, full_name, email, employee_id, employees(name)")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  // Prefer the linked employee's name; fall back to full_name; never show email as a name
  const empRel = data.employees;
  const employeeName = (Array.isArray(empRel) ? empRel[0]?.name : (empRel as { name: string } | null)?.name) ?? null;
  const displayName = employeeName ?? (data.full_name as string | null) ?? null;
  return {
    id: userId,
    email: (data.email as string | null) ?? email,
    role: (data.role as UserRole) ?? "user",
    name: displayName ?? email,
    employeeId: (data.employee_id as string | null) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseClient) {
      setLoading(false);
      return;
    }

    supabaseClient.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const profile = await fetchProfile(user.id, user.email ?? "");
        setUser(profile);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        // Re-verify with getUser() — do not trust session.user directly
        const { data: { user } } = await supabaseClient!.auth.getUser();
        if (user) {
          const profile = await fetchProfile(user.id, user.email ?? "");
          setUser(profile);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!supabaseClient) return "Supabase not configured";
      console.log("[auth] calling signInWithPassword for:", email);
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      console.log("[auth] signInWithPassword result — error:", error?.message ?? "none");
      return error?.message ?? null;
    },
    []
  );

  const signOut = useCallback(async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]): boolean => {
      if (!supabaseClient) return true;
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}