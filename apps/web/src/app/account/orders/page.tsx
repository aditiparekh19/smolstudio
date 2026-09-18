"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import { myOrdersQuery } from "../../../lib/orders";
import { useAuth } from "../../../components/AuthProvider";
type O = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalInr: number;
  createdAt: string;
};
export default function Orders() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<O[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (loading || !user) return;
    void apiClient()
      .request<{ myOrders: O[] }>(myOrdersQuery)
      .then((r) => setOrders(r.myOrders))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load orders."),
      );
  }, [loading, user]);
  if (loading)
    return <main className="mx-auto max-w-4xl px-5 py-16">Loading…</main>;
  if (!user)
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <Link href="/account" className="text-sm text-[#8b7a70]">
        ← Account
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Your orders</h1>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-8 divide-y divide-[#eadfd5] rounded-[2rem] border border-[#eadfd5] bg-white">
        {orders.length === 0 ? (
          <p className="p-7 text-[#8b7a70]">No orders yet.</p>
        ) : (
          orders.map((o) => (
            <Link
              href={`/account/orders/${o.id}`}
              key={o.id}
              className="flex flex-wrap items-center gap-4 p-6 hover:bg-[#fffaf4]"
            >
              <div className="flex-1">
                <p className="font-medium text-[#5e473c]">{o.orderNumber}</p>
                <p className="mt-1 text-xs text-[#8b7a70]">
                  {new Date(o.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              <span className="rounded-full bg-[#f3e7d7] px-3 py-1 text-xs">
                {o.status}
              </span>
              <strong>₹{Number(o.totalInr).toLocaleString("en-IN")}</strong>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
