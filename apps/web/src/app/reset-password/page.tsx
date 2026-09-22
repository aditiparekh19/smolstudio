"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "../../lib/graphql";

const resetPasswordMutation = `
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setError("");

    if (!token) {
      setError("This password reset link is invalid.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const client = apiClient();

      await client.request(resetPasswordMutation, {
        token,
        newPassword: password,
      });

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "This password reset link is invalid or has expired.";

      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
          Password updated
        </p>

        <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
          You're all set
        </h1>

        <div className="mt-10 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-7">
          <p className="text-sm leading-6 text-[#5f554f]">
            Your password has been changed successfully. You can now sign in
            with your new password.
          </p>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-7 w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-sm font-medium text-white"
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
        Account security
      </p>

      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
        Reset password
      </h1>

      <p className="mt-4 text-sm leading-6 text-[#8b7a70]">
        Choose a new password for your SmolStudio account.
      </p>

      <form
        onSubmit={submit}
        className="mt-10 space-y-5 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-7"
      >
        <label className="block text-sm">
          New password
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3 outline-none"
          />
        </label>

        <label className="block text-sm">
          Confirm new password
          <input
            required
            minLength={8}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3 outline-none"
          />
        </label>

        {error && <p className="text-sm leading-6 text-red-700">{error}</p>}

        <button
          disabled={busy || !token}
          className="w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Updating password…" : "Update password"}
        </button>

        <p className="text-center text-sm text-[#8b7a70]">
          Remember your password?{" "}
          <Link href="/login" className="text-[#5e473c] underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-5 py-16">
          <p className="text-sm text-[#8b7a70]">Loading…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
