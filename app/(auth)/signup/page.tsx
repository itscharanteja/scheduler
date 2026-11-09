"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMessage("Please fill in all required fields.");
      toast.error("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Failed to sign up.";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      toast.success(data.message || "Account created successfully!");

      // Attempt automatic sign-in
      const signInError = await signIn(email.trim(), password.trim());
      if (!signInError) {
        router.push("/");
      } else {
        router.push("/login");
      }
    } catch (err) {
      console.error("[signup submit error]", err);
      const fallback = "An unexpected error occurred. Please try again.";
      setErrorMessage(fallback);
      toast.error(fallback);
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
            Create your account
          </p>
        </div>

        <div className="app-panel p-6">
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="flex-1 font-medium leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                autoFocus
                disabled={loading}
              />
            </div>

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
                placeholder="At least 6 characters"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-[#756458]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#8F4B30] underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[#756458]">
          Signups require approval by an administrator.
        </p>
      </div>
    </div>
  );
}
