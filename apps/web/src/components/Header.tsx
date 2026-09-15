'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { useCart } from './CartProvider';

export function Header() {
  const { user } = useAuth();
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-[#eadfd5]/80 bg-[#fbf7f0]/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="font-serif text-2xl tracking-[-0.03em] text-[#5e473c]">
          Smol<span className="italic">Studio</span>
        </Link>
        <nav className="hidden gap-7 text-sm text-[#6d5b51] md:flex">
          <Link href="/?categorySlug=newborn" className="hover:text-[#252321]">Newborn</Link>
          <Link href="/?categorySlug=vests" className="hover:text-[#252321]">Vests</Link>
          <Link href="/?categorySlug=sets" className="hover:text-[#252321]">Sets</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/search" aria-label="Search" className="rounded-full p-2 text-[#5e473c] hover:bg-[#f0e4d8]">⌕</Link>
          <Link href={user ? '/account' : '/login'} className="hidden rounded-full px-3 py-2 text-sm text-[#5e473c] hover:bg-[#f0e4d8] sm:block">
            {user ? (user.firstName || 'Account') : 'Login'}
          </Link>
          <Link href="/cart" aria-label="Cart" className="rounded-full px-3 py-2 text-sm text-[#5e473c] hover:bg-[#f0e4d8]">
            Bag{count > 0 ? ` (${count})` : ''}
          </Link>
        </div>
      </div>
    </header>
  );
}
