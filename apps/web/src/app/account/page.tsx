"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useState } from "react";

const accountLinks = [
  {
    href: "/account/addresses",
    title: "Saved addresses",
    description: "Keep your delivery details ready for checkout.",
    icon: "⌂",
  },
  {
    href: "/account/wishlist",
    title: "Wishlist",
    description: "Your little collection of things you love.",
    icon: "♡",
  },
  {
    href: "/account/orders",
    title: "Order history",
    description: "View your past orders and purchases.",
    icon: "↗",
  },
  {
    href: "/account/returns",
    title: "Returns",
    description: "Manage returns and after-sales requests.",
    icon: "↩",
  },
  {
    href: "/account/store-credit",
    title: "Store credit",
    description: "Check your available SmolStudio credit.",
    icon: "₹",
  },
  {
    href: "/cart",
    title: "View bag",
    description: "See what's waiting in your shopping bag.",
    icon: "♡",
  },
];

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  if (loading || loggingOut) {
    return (
      <main className="min-h-screen bg-[#fcf8f3] px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
            Back office
          </p>

          <h1 className="mt-3 font-serif text-4xl text-[#5e473c]">
            {loggingOut ? "Logging out…" : "Loading…"}
          </h1>

          <p className="mt-3 text-sm text-[#8b7a70]">
            {loggingOut
              ? "Taking you back to SmolStudio."
              : "Preparing the back office."}
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[70vh] bg-[#fcf8f3] px-5 py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[#8b7a70]">
            Account
          </p>

          <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em] text-[#5e473c]">
            Your account
          </h1>

          <p className="mt-5 max-w-md text-sm leading-7 text-[#8b7a70]">
            Sign in to view your orders, wishlist, saved addresses and
            everything you've collected at SmolStudio.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex rounded-full bg-[#5e473c] px-7 py-3.5 text-sm font-medium text-white transition hover:bg-[#4d392f]"
          >
            Sign in
          </Link>
        </div>
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
    <main className="min-h-[80vh] bg-[#fcf8f3] px-5 py-12 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[#9a877c]">
            Account
          </p>

          <h1 className="mt-4 font-serif text-5xl tracking-[-0.045em] text-[#5e473c] sm:text-6xl">
            Hello
            {isAdmin
              ? `, ${user.role === "ADMIN" ? "Admin" : "Staff"}`
              : user.firstName
                ? `, ${user.firstName}`
                : ""}
            .
          </h1>

          <p className="mt-5 text-sm leading-7 text-[#8b7a70]">
            Welcome back to your little corner of SmolStudio.
          </p>
        </div>

        {/* Profile card */}
        <section className="mt-10 overflow-hidden rounded-4xl border border-[#eadfd5] bg-[#fffaf4]">
          <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#eadfd5] font-serif text-2xl text-[#5e473c]">
                {user.firstName?.charAt(0)?.toUpperCase() ||
                  user.email.charAt(0).toUpperCase()}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#9a877c]">
                  Signed in as
                </p>

                <p className="mt-1 break-all text-sm text-[#332c28]">
                  {user.email}
                </p>

                {isAdmin && (
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[#8b7a70]">
                    {user.role}
                  </p>
                )}
              </div>
            </div>

            {!isAdmin && (
              <Link
                href="/"
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#5e473c] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#4d392f]"
              >
                Shop the Collection
              </Link>
            )}
          </div>
        </section>

        {isAdmin ? (
          <section className="mt-10">
            <div className="rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-8 sm:p-10">
              <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
                Management
              </p>

              <h2 className="mt-3 font-serif text-3xl text-[#5e473c]">
                Store dashboard
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-7 text-[#8b7a70]">
                Manage products, orders, customers and the rest of your
                SmolStudio store.
              </p>

              <Link
                href="/admin"
                className="mt-7 inline-flex rounded-full bg-[#5e473c] px-7 py-3.5 text-sm font-medium text-white transition hover:bg-[#4d392f]"
              >
                Open admin dashboard
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Account shortcuts */}
            <section className="mt-12">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
                  Your space
                </p>

                <h2 className="mt-2 font-serif text-3xl text-[#5e473c]">
                  Manage your account
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {accountLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-[1.5rem] border border-[#eadfd5] bg-[#fffaf4] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#d9c8bb] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <h3 className="text-base font-medium text-[#5e473c]">
                          {item.title}
                        </h3>

                        <p className="mt-2 max-w-sm text-sm leading-6 text-[#8b7a70]">
                          {item.description}
                        </p>
                      </div>

                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1e5d7] font-serif text-lg text-[#6d5b51] transition group-hover:bg-[#eadfd5]">
                        {item.icon}
                      </span>
                    </div>

                    <div className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-[#8b7a70] transition group-hover:text-[#5e473c]">
                      Explore →
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Shopping CTA */}
            <section className="mt-10 overflow-hidden rounded-4xl bg-[#eadfd5]">
              <div className="flex flex-col items-start justify-between gap-7 p-8 sm:flex-row sm:items-center sm:p-10">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8b7568]">
                    Something caught your eye?
                  </p>

                  <h2 className="mt-3 font-serif text-3xl text-[#5e473c]">
                    Find something lovely.
                  </h2>

                  <p className="mt-2 max-w-lg text-sm leading-6 text-[#75645b]">
                    Browse the latest little things we've made and discover
                    something new for your space.
                  </p>
                </div>

                <Link
                  href="/"
                  className="shrink-0 rounded-full bg-[#5e473c] px-7 py-3.5 text-sm font-medium text-white transition hover:bg-[#4d392f]"
                >
                  Shop the Collection
                </Link>
              </div>
            </section>
          </>
        )}

        {/* Logout */}
        <div className="mt-10 border-t border-[#eadfd5] pt-7">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="rounded-full border border-[#e6d8cc] bg-[#f6eee7] px-5 py-2.5 text-sm font-medium text-[#5e473c] transition hover:bg-[#efe4da] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </div>
    </main>
  );
}
