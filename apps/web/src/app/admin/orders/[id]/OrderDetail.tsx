"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../../lib/graphql";
import {
  adminOrderQuery,
  adminRefundMutation,
  adminUpdateOrderMutation,
} from "../../../../lib/orders";
import { useAuth } from "../../../../components/AuthProvider";
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotalInr: number;
  shippingInr: number;
  discountInr: number;
  taxInr: number;
  totalInr: number;
  customerEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  customerPhone: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  createdAt: string;
  shippingAddress: any;
  items: any[];
  history: any[];
  refunds: any[];
};
const statuses = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];
export default function AdminOrderClient({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const [o, setO] = useState<Order | null>(null);
  const [status, setStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState("");
  const [refundReason, setRefundReason] = useState("Customer refund");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const r = await apiClient().request<{ adminOrder: Order }>(
          adminOrderQuery,
          { id },
        );
        setO(r.adminOrder);
        setStatus(r.adminOrder.status);
        setTrackingNumber(r.adminOrder.trackingNumber || "");
        setCarrier(r.adminOrder.carrier || "");
        setTrackingUrl(r.adminOrder.trackingUrl || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load order.");
      } finally {
        setBusy(false);
      }
    })();
  }, [id, loading, user]);
  async function save() {
    if (!o) return;
    setBusy(true);
    try {
      const r = await apiClient().request<{ updateAdminOrder: Order }>(
        adminUpdateOrderMutation,
        {
          id: o.id,
          status,
          trackingNumber: trackingNumber || null,
          carrier: carrier || null,
          trackingUrl: trackingUrl || null,
          note: note || null,
        },
      );
      setO(r.updateAdminOrder);
      setMessage("Order updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function doRefund() {
    if (!o) return;
    const amount = Number(refund);
    if (!amount || amount <= 0) return setError("Enter a valid refund amount.");
    setBusy(true);
    try {
      const r = await apiClient().request<{ refundOrder: Order }>(
        adminRefundMutation,
        { id: o.id, amountInr: Math.round(amount), reason: refundReason },
      );
      setO(r.refundOrder);
      setRefund("");
      setMessage("Refund processed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setBusy(false);
    }
  }
  if (loading || (busy && !o))
    return <main className="mx-auto max-w-6xl px-5 py-16">Loading order…</main>;
  if (!user || !["ADMIN", "STAFF"].includes(user.role))
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        Admin access required.
      </main>
    );
  if (!o)
    return (
      <main className="mx-auto max-w-6xl px-5 py-16 text-red-700">
        {error || "Order not found."}
      </main>
    );
  const a = o.shippingAddress || {};
  const q = encodeURIComponent(
    [a.line1, a.line2, a.city, a.state, a.postalCode, a.countryCode || "IN"]
      .filter(Boolean)
      .join(", "),
  );
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <Link href="/admin/orders" className="text-sm text-[#8b7a70]">
        ← Orders
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-5xl text-[#5e473c]">
            {o.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-[#8b7a70]">
            {new Date(o.createdAt).toLocaleString("en-IN")} ·{" "}
            {o.customerEmail || "Guest"}
          </p>
        </div>
        <span className="rounded-full bg-[#f3e7d7] px-4 py-2 text-sm">
          {o.status} · {o.paymentStatus}
        </span>
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          {message}
        </p>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6">
            <h2 className="font-serif text-2xl text-[#5e473c]">Items</h2>
            {o.items.map((i) => (
              <div
                key={i.id}
                className="flex justify-between gap-4 border-b border-[#f0e8e2] py-4"
              >
                <div>
                  <p className="font-medium">{i.productName}</p>
                  <p className="text-xs text-[#8b7a70]">
                    {i.sku} · Qty {i.quantity}
                  </p>
                </div>
                <span>₹{Number(i.totalPriceInr).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{o.subtotalInr}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>₹{o.shippingInr}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>₹{o.taxInr}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>- ₹{o.discountInr}</span>
              </div>
              <div className="flex justify-between border-t pt-3 font-medium">
                <span>Total</span>
                <span>₹{Number(o.totalInr).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6">
            <h2 className="font-serif text-2xl text-[#5e473c]">
              Order timeline
            </h2>
            {o.history.map((h: any, i: number) => (
              <div key={i} className="border-l border-[#d9cbc0] py-2 pl-4">
                <p className="text-sm font-medium">{h.status}</p>
                <p className="text-xs text-[#8b7a70]">
                  {new Date(h.createdAt).toLocaleString("en-IN")}
                  {h.note ? ` · ${h.note}` : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6">
            <h2 className="font-serif text-2xl text-[#5e473c]">Refunds</h2>
            {o.refunds.length ? (
              o.refunds.map((r: any) => (
                <div
                  key={r.id}
                  className="flex justify-between border-b py-3 text-sm"
                >
                  <span>
                    {r.refundId || "Refund"} · {r.status}
                  </span>
                  <strong>₹{r.amountInr}</strong>
                </div>
              ))
            ) : (
              <p className="mt-3 text-sm text-[#8b7a70]">No refunds yet.</p>
            )}
            {o.paymentStatus === "CAPTURED" && (
              <div className="mt-5 grid gap-3">
                <input
                  type="number"
                  value={refund}
                  onChange={(e) => setRefund(e.target.value)}
                  placeholder="Refund amount"
                  className="rounded-xl border border-[#d9cbc0] px-3 py-3"
                />
                <input
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="rounded-xl border border-[#d9cbc0] px-3 py-3"
                />
                <button
                  disabled={busy}
                  onClick={() => void doRefund()}
                  className="rounded-full border border-red-200 px-5 py-3 text-red-700"
                >
                  Issue Razorpay refund
                </button>
              </div>
            )}
          </div>
          <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6">
            <h2 className="font-serif text-2xl text-[#5e473c]">
              Delivery address
            </h2>
            <p className="mt-4 text-sm leading-6">
              {a.recipientName}
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              <br />
              {a.city}, {a.state} {a.postalCode}
              <br />
              {a.countryCode || "IN"}
              {a.phone && (
                <>
                  <br />
                  {a.phone}
                </>
              )}
            </p>
            <a
              className="mt-4 inline-block underline text-sm"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${q}`}
            >
              Open location in Google Maps
            </a>
          </div>
        </section>
        <aside className="h-fit rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-6">
          <h2 className="font-serif text-2xl text-[#5e473c]">Fulfillment</h2>
          <label className="mt-5 block text-sm">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-3 py-3"
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm">
            Carrier
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-3 py-3"
            />
          </label>
          <label className="mt-4 block text-sm">
            Tracking number
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-3 py-3"
            />
          </label>
          <label className="mt-4 block text-sm">
            Tracking URL
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-3 py-3"
            />
          </label>
          <label className="mt-4 block text-sm">
            Internal note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-3 py-3"
            />
          </label>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="mt-6 w-full rounded-full bg-[#5e473c] px-5 py-3 text-sm text-white"
          >
            {busy ? "Saving…" : "Save fulfillment"}
          </button>
          {o.trackingUrl && (
            <a
              href={o.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-sm underline"
            >
              Open tracking link
            </a>
          )}
        </aside>
      </div>
    </main>
  );
}
