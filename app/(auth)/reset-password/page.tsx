"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkiftIcon } from "@/components/skift-icon";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    if (!supabaseClient) {
      toast.error("Supabase not configured");
      return;
    }

    setLoading(true);
    const { error } = await supabaseClient.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated — signing you in");
    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFF8F0] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/welcome" className="inline-flex items-center justify-center gap-2 text-3xl font-semibold tracking-[-0.04em] text-[#30251F]">
            <SkiftIcon className="h-7 w-7" />
            <span>skift<span className="text-[#C65B3B]">.</span></span>
          </Link>
          <p className="mt-2 text-sm text-[#756458]">Set your new password</p>
        </div>

        <div className="app-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                New password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Set password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}