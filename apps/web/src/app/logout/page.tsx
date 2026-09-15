'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();
  useEffect(() => { void logout().finally(() => router.replace('/')); }, [logout, router]);
  return <main className="mx-auto max-w-md px-5 py-16 text-center"><p className="text-sm text-[#8b7a70]">Signing you out…</p></main>;
}
