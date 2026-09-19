'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { apiClient, meQuery } from '../../../lib/graphql';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      const me = await apiClient().request<{ me: { role: string } | null }>(meQuery);
      if (me.me && (me.me.role === 'ADMIN' || me.me.role === 'STAFF')) {
        router.push('/admin');
        router.refresh();
      } else {
        setError('This account does not have admin access.');
      }
    } catch (err) {
      setPassword('');
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">SmolStudio</p>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Admin sign in</h1>
      <form onSubmit={submit} className="mt-10 space-y-4 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-7">
        <input required type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3" />
        <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in as admin'}</button>
      </form>
    </main>
  );
}
