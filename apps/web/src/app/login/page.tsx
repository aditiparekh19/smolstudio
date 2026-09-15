"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await login(email, password);
      router.push(result ? "/account" : "/");
      router.refresh();
    } catch (e) {
      setPassword("");
      setError('Invalid email or password. Please check your credentials and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
        Welcome back
      </p>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Sign in</h1>
      <form
        onSubmit={submit}
        className="mt-10 space-y-4 rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-7"
      >
        <label className="block text-sm">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3 outline-none"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-[#8b7a70]">
          New here?{" "}
          <Link href="/register" className="text-[#5e473c] underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
