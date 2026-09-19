"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import { adminOrdersQuery } from "../../../lib/orders";
import { useAuth } from "../../../components/AuthProvider";
type Row = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalInr: number;
  createdAt: string;
  customerEmail: string | null;
  firstName: string | null;
  lastName: string | null;
};
const statuses = [
  "",
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];
export default function AdminOrdersPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const r = await apiClient().request<{ adminOrders: Row[] }>(
        adminOrdersQuery,
        { search: search || undefined, status: status || undefined },
      );
      setRows(r.adminOrders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load orders.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!loading && user) void load();
  }, [loading, user, status]);
  if (loading)
    return <main className="mx-auto max-w-7xl px-5 py-16">Loading…</main>;
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF"))
    return (
      <main className="mx-auto max-w-7xl px-5 py-16">
        Admin access required.
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <Link href="/admin" className="text-sm text-[#8b7a70]">
        ← Back office
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Orders</h1>
      <p className="mt-2 text-[#8b7a70]">
        Payments, fulfillment and delivery tracking.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
          placeholder="Search order or customer"
          className="min-w-[280px] flex-1 rounded-full border border-[#d9cbc0] bg-white px-5 py-3"
        />
        <button
          onClick={() => void load()}
          className="rounded-full border border-[#cdbfb5] px-5 py-3"
        >
          Search
        </button>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-[#d9cbc0] bg-white px-4 py-3"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 overflow-hidden rounded-4xl border border-[#eadfd5] bg-white">
        {busy ? (
          <p className="p-8 text-[#8b7a70]">Loading orders…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-[#8b7a70]">No orders found.</p>
        ) : (
          <div className="divide-y divide-[#eadfd5]">
            {rows.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex flex-wrap items-center gap-4 p-5 hover:bg-[#fffaf4]"
              >
                <div className="min-w-[220px] flex-1">
                  <p className="font-medium text-[#5e473c]">{o.orderNumber}</p>
                  <p className="mt-1 text-xs text-[#8b7a70]">
                    {o.customerEmail || "Guest"} ·{" "}
                    {new Date(o.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
                <span className="rounded-full bg-[#f3e7d7] px-3 py-1 text-xs">
                  {o.status}
                </span>
                <span className="text-sm">{o.paymentStatus}</span>
                <strong>₹{Number(o.totalInr).toLocaleString("en-IN")}</strong>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
