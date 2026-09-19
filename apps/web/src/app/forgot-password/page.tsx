"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiClient } from "../../lib/graphql";

const forgotPasswordMutation = `
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setError("");
    setBusy(true);

    try {
      const client = apiClient();

      await client.request(forgotPasswordMutation, {
        email: email.trim(),
      });

      setSuccess(true);
    } catch {
      setError(
        "We couldn't send the password reset email. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
          Check your email
        </p>

        <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
          Reset link sent
        </h1>

        <div className="mt-10 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-7">
          <p className="text-sm leading-6 text-[#5f554f]">
            If an account exists for this email address, we&apos;ve sent a
            password reset link. Please check your inbox.
          </p>

          <p className="mt-4 text-sm leading-6 text-[#8b7a70]">
            The link will expire in 30 minutes and can only be used once.
          </p>

          <Link
            href="/login"
            className="mt-7 block w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-center text-sm font-medium text-white"
          >
            Back to sign in
          </Link>
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
        Forgot password?
      </h1>

      <p className="mt-4 text-sm leading-6 text-[#8b7a70]">
        Enter the email address associated with your SmolStudio account and
        we&apos;ll send you a link to reset your password.
      </p>

      <form
        onSubmit={submit}
        className="mt-10 space-y-5 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-7"
      >
        <label className="block text-sm">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3 outline-none"
            placeholder="you@example.com"
          />
        </label>

        {error && (
          <p className="text-sm leading-6 text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Sending link…" : "Send reset link"}
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
