"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    if (!supabaseClient) {
      toast.error("Supabase not configured");
      return;
    }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password` }
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    setResetSent(true);
    toast.success("Password reset email sent");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[login] submit fired, email:", email, "password length:", password.length);
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter your email and password");
      return;
    }
    setLoading(true);
    try {
      const error = await signIn(email.trim(), password);
      if (error) {
        toast.error(error);
        return;
      }
      router.push("/");
    } catch (err) {
      toast.error("An unexpected error occurred. Check the console.");
      console.error("[login]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
            Skift
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to your workspace
          </p>
        </div>

        <div className="app-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
              disabled={loading}
            >
              {resetSent ? "Email sent — check your inbox" : "Forgot password?"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Contact your administrator to get an account.
        </p>
      </div>
    </div>
  );
}