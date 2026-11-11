"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { signIn } = useAuth();
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
      window.location.href = "/";
    } catch (err) {
      toast.error("An unexpected error occurred. Check the console.");
      console.error("[login]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/welcome" className="inline-flex items-center justify-center gap-2 text-3xl font-semibold tracking-[-0.04em] text-[#30251F]">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="h-7 w-7 text-[#C65B3B]">
              <path d="M6 7h8v8H6zM18 7h8v8h-8zM6 19h8v8H6z" fill="currentColor" />
              <path d="m21.5 17 6 6-6 6-6-6 6-6Z" fill="#F6BB86" />
            </svg>
            <span>skift<span className="text-[#C65B3B]">.</span></span>
          </Link>
          <p className="mt-2 text-sm text-[#756458]">
            Sign in to your workspace
          </p>
        </div>

        <div className="app-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#554438]">
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
              <label className="mb-1.5 block text-sm font-medium text-[#554438]">
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
              className="text-xs text-[#756458] hover:text-[#30251F] underline-offset-2 hover:underline"
              disabled={loading}
            >
              {resetSent ? "Email sent — check your inbox" : "Forgot password?"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#756458]">
          Have an invited email?{" "}
          <Link href="/signup" className="font-medium text-[#8F4B30] underline-offset-2 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}