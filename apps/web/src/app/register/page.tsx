'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function RegisterPage() {
  const router = useRouter(); const { register } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setBusy(true); try { await register(form); router.push('/account'); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create account.'); } finally { setBusy(false); } }
  return <main className="mx-auto max-w-md px-5 py-16"><p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">Join SmolStudio</p><h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Create account</h1><form onSubmit={submit} className="mt-10 space-y-4 rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-7"><div className="grid grid-cols-2 gap-3"><input placeholder="First name" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} className="rounded-xl border border-[#d9cbc0] bg-white px-4 py-3" /><input placeholder="Last name" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} className="rounded-xl border border-[#d9cbc0] bg-white px-4 py-3" /></div><input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3" /><input required minLength={8} type="password" placeholder="Password (8+ characters)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3" />{error && <p className="text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create account'}</button><p className="text-center text-sm text-[#8b7a70]">Already have an account? <Link href="/login" className="text-[#5e473c] underline">Sign in</Link></p></form></main>;
}
