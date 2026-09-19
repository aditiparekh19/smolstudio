"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useCart } from "./CartProvider";

export function Header() {
  const { user } = useAuth();
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-[#eadfd5]/80 bg-[#fbf7f0]/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center px-5 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 font-serif text-2xl tracking-[-0.04em] text-[#5e473c]"
        >
          Smol<span className="italic">Studio</span>
        </Link>
        {/* Navigation - pushed toward the right */}
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Link
            href="/journal"
            className="rounded-full px-4 py-2 text-[15px] text-[#6d5b51] transition-colors hover:bg-[#f0e4d8] hover:text-[#252321]"
          >
            Journal
          </Link>

          <Link
            href="/contact"
            className="rounded-full px-4 py-2 text-[15px] text-[#6d5b51] transition-colors hover:bg-[#f0e4d8] hover:text-[#252321]"
          >
            Contact Us
          </Link>

          <a
            href="https://www.instagram.com/smolstudio_/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-4 py-2 text-[15px] text-[#6d5b51] transition-colors hover:bg-[#f0e4d8] hover:text-[#252321]"
          >
            Instagram
          </a>

          <Link
            href="/account/wishlist"
            className="rounded-full px-4 py-2 text-[15px] text-[#6d5b51] transition-colors hover:bg-[#f0e4d8] hover:text-[#252321]"
          >
            Wishlist
          </Link>
        </nav>

        {/* Right utilities */}
        <div className="ml-3 flex items-center gap-1 border-l border-[#eadfd5] pl-3">
          <Link
            href="/search"
            aria-label="Search"
            className="rounded-full px-4 py-2 text-[15px] text-[#6d5b51] transition-colors hover:bg-[#f0e4d8] hover:text-[#252321]"
          >
            ⌕
          </Link>

          <Link
            href={user ? "/account" : "/login"}
            className="hidden rounded-full px-4 py-2 text-[15px] text-[#6d5b51] transition-colors hover:bg-[#f0e4d8] hover:text-[#252321] sm:block"
          >
            {user ? user.firstName || "Account" : "Login"}
          </Link>

          <Link
            href="/cart"
            aria-label="Cart"
            className="rounded-full px-4 py-2 text-[15px] text-[#6d5b51] transition-colors hover:bg-[#f0e4d8] hover:text-[#252321]"
          >
            Bag{count > 0 ? ` (${count})` : ""}
          </Link>
        </div>
      </div>
    </header>
  );
}
