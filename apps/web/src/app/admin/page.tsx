"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { apiClient } from "../../lib/graphql";
import { adminStatsQuery } from "../../lib/orders";

type Stats = {
  productCount: number;
  activeProductCount: number;
  customerCount: number;
  orderCount: number;
  pendingOrderCount: number;
  revenueInr: number;
  returnRequestCount: number;
  outOfStockCount: number;
};

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && user && (user.role === "ADMIN" || user.role === "STAFF")) {
      void apiClient()
        .request<{ adminStats: Stats }>(adminStatsQuery)
        .then((r) => setS(r.adminStats))
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Unable to load dashboard.",
          ),
        );
    }
  }, [loading, user]);

  if (loading || loggingOut) {
    return (
      <main className="min-h-screen bg-[#fcf8f3] px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
            Back office
          </p>

          <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-[#5e473c] sm:text-5xl">
            {loggingOut ? "Logging out…" : "Loading dashboard…"}
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

  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return (
      <main className="min-h-screen bg-[#fcf8f3] px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
            Back office
          </p>

          <h1 className="mt-3 font-serif text-5xl tracking-[-0.03em] text-[#5e473c]">
            Admin
          </h1>

          <p className="mt-4 max-w-lg text-[#8b7a70]">
            You need an admin account to access this area.
          </p>

          <Link
            href="/admin/login"
            className="mt-7 inline-flex rounded-full bg-[#5e473c] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#4d392f]"
          >
            Admin sign in
          </Link>
        </div>
      </main>
    );
  }

  async function handleLogout() {
    setLoggingOut(true);

    await logout();

    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-[#fcf8f3] px-5 py-10 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="flex flex-col gap-6 border-b border-[#eadfd5] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
              Back office
            </p>

            <h1 className="mt-2 font-serif text-5xl tracking-[-0.04em] text-[#5e473c] sm:text-6xl">
              Dashboard
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b7a70]">
              Keep an eye on your catalogue, orders, customers and store
              activity from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-[#d9c9bd] bg-[#fffaf4] px-5 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#f4ebe3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </header>

        {/* Error */}
        {error && (
          <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Overview */}
        <section className="mt-12">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
              Overview
            </p>

            <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#5e473c]">
              Store at a glance
            </h2>
          </div>

          {/* Primary statistics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Products"
              value={s?.productCount ?? "-"}
              detail={
                s
                  ? `${s.activeProductCount} active products`
                  : "Loading product data"
              }
            />

            <Metric
              label="Orders"
              value={s?.orderCount ?? "-"}
              detail={
                s
                  ? `${s.pendingOrderCount} pending orders`
                  : "Loading order data"
              }
            />

            <Metric
              label="Customers"
              value={s?.customerCount ?? "-"}
              detail="Registered customers"
            />

            <Metric
              label="Revenue"
              value={
                s
                  ? `₹${Number(s.revenueInr).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "-"
              }
              detail="Store revenue"
              large
            />
          </div>

          {/* Secondary statistics */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SecondaryMetric
              label="Active products"
              value={s?.activeProductCount ?? "-"}
              detail="Currently available"
            />

            <SecondaryMetric
              label="Return requests"
              value={s?.returnRequestCount ?? "-"}
              detail="Awaiting attention"
            />

            <SecondaryMetric
              label="Out of stock"
              value={s?.outOfStockCount ?? "-"}
              detail="Products unavailable"
            />
          </div>
        </section>

        {/* Manage store */}
        <section className="mt-14">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
              Manage your store
            </p>

            <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#5e473c]">
              Everything in one place
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#8b7a70]">
              Manage your catalogue, orders, customers and store operations.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminActionCard
              href="/admin/products"
              title="Products"
              description="Manage your catalogue, pricing, variants and product images."
              icon="✦"
            />

            <AdminActionCard
              href="/admin/orders"
              title="Orders"
              description="Review orders, payments, fulfilment and tracking details."
              icon="↗"
            />

            <AdminActionCard
              href="/admin/customers"
              title="Customers"
              description="View customer accounts and their order activity."
              icon="♡"
            />

            <AdminActionCard
              href="/admin/categories"
              title="Categories"
              description="Organise products and manage your store catalogue."
              icon="◫"
            />

            <AdminActionCard
              href="/admin/coupons"
              title="Coupons"
              description="Create and manage discounts and promotional codes."
              icon="%"
            />

            <AdminActionCard
              href="/admin/returns"
              title="Returns"
              description="Review return requests and manage after-sales activity."
              icon="↩︎"
            />

            <AdminActionCard
              href="/admin/reviews"
              title="Reviews"
              description="Review customer feedback and manage published reviews."
              icon="☆"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  large = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-[1.75rem] border border-[#eadfd5] bg-[#fffaf4] p-6">
      <p className="text-sm font-medium text-[#8b7a70]">{label}</p>

      <p
        className={`mt-4 font-serif tracking-[-0.04em] text-[#5e473c] ${
          large ? "text-3xl" : "text-4xl"
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-sm text-[#9a877c]">{detail}</p>
    </div>
  );
}

function SecondaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#eadfd5] bg-[#fffaf4] p-5">
      <p className="text-sm font-medium text-[#8b7a70]">{label}</p>

      <p className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[#5e473c]">
        {value}
      </p>

      <p className="mt-1 text-sm text-[#9a877c]">{detail}</p>
    </div>
  );
}

function AdminActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.75rem] border border-[#eadfd5] bg-[#fffaf4] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#d9c8bb] hover:bg-white hover:shadow-[0_12px_35px_rgba(94,71,60,0.07)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0e4d8] text-lg ${
            icon === "↩" ? "text-[#252321]" : "text-[#5e473c]"
          }`}
        >
          {icon}
        </div>

        <span className="text-lg text-[#b09d91] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#5e473c]">
          →
        </span>
      </div>

      <h3 className="mt-6 font-serif text-2xl tracking-[-0.02em] text-[#5e473c]">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#8b7a70]">{description}</p>

      <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-[#9a877c]">
        Manage
      </p>
    </Link>
  );
}
