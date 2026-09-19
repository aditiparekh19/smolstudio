"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useState } from "react";

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  if (loading || loggingOut) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        Loading…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="font-serif text-5xl text-[#5e473c]">
          Your account
        </h1>

        <p className="mt-4 text-[#8b7a70]">
          Sign in to view your account.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";

  async function handleLogout() {
    setLoggingOut(true);

    await logout();

    router.replace("/");
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
        Account
      </p>

      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
        Hello{user.firstName ? `, ${user.firstName}` : ""}.
      </h1>

      <div className="mt-10 rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-7">
        <p className="text-sm text-[#8b7a70]">
          Signed in as
        </p>

        <p className="mt-1 text-[#332c28]">
          {user.email}
        </p>

        {isAdmin && (
          <>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[#8b7a70]">
              Role
            </p>

            <p className="mt-1 text-sm text-[#332c28]">
              {user.role}
            </p>
          </>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          {isAdmin ? (
            <Link
              href="/admin"
              className="rounded-full bg-[#5e473c] px-5 py-3 text-sm text-white"
            >
              Admin dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/account/addresses"
                className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da]"
              >
                Saved addresses
              </Link>

              <Link
                href="/account/wishlist"
                className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da]"
              >
                Wishlist
              </Link>

              <Link
                href="/account/returns"
                className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da]"
              >
                Returns
              </Link>

              <Link
                href="/account/orders"
                className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da]"
              >
                Order history
              </Link>

              <Link
                href="/account/store-credit"
                className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da]"
              >
                Store credit
              </Link>

              <Link
                href="/cart"
                className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da]"
              >
                View bag
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da] disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </div>
    </main>
  );
}
