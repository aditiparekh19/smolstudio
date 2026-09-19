"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../../lib/graphql";
import {
  adminOrderQuery,
  adminRefundMutation,
  adminUpdateOrderMutation,
  adminReturnsQuery,
  updateReturnRequestMutation,
} from "../../../../lib/orders";
import { useAuth } from "../../../../components/AuthProvider";

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceInr: number;
  totalPriceInr: number;
};

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
  items: OrderItem[];
  history: any[];
  refunds: any[];
};

type AfterSalesRequest = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string | null;
  orderItemId: string | null;
  requestType: string | null;
  requestedSize: string | null;
  reason: string;
  status: string;
  refundAmountInr: number | null;
  approvedCreditInr: number | null;
  replacementVariantId: string | null;
  replacementOrderId: string | null;
  adminNote: string | null;
  adminReviewedAt: string | null;
  adminReviewedBy: string | null;
  replacementFulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  const [afterSales, setAfterSales] = useState<AfterSalesRequest[]>([]);

  const [status, setStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [note, setNote] = useState("");

  const [refund, setRefund] = useState("");
  const [refundReason, setRefundReason] = useState("Customer refund");

  const [busy, setBusy] = useState(true);
  const [afterSalesBusy, setAfterSalesBusy] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  async function loadAfterSales() {
    const r = await apiClient().request<{
      adminReturns: AfterSalesRequest[];
    }>(adminReturnsQuery, {});

    const requests = (r.adminReturns || []).filter(
      (request) => request.orderId === id,
    );

    setAfterSales(requests);

    const notes: Record<string, string> = {};
    for (const request of requests) {
      notes[request.id] = request.adminNote || "";
    }
    setAdminNotes(notes);
  }

  useEffect(() => {
    if (loading || !user) return;

    (async () => {
      try {
        const [orderResult] = await Promise.all([
          apiClient().request<{ adminOrder: Order }>(adminOrderQuery, { id }),
          loadAfterSales(),
        ]);

        setO(orderResult.adminOrder);
        setStatus(orderResult.adminOrder.status);
        setTrackingNumber(orderResult.adminOrder.trackingNumber || "");
        setCarrier(orderResult.adminOrder.carrier || "");
        setTrackingUrl(orderResult.adminOrder.trackingUrl || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load order.");
      } finally {
        setBusy(false);
      }
    })();
  }, [id, loading, user]);

  async function save() {
    if (!o) return;

    setError("");
    setMessage("");
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

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }

    if (!canIssueManualRefund) {
      setError("There is no remaining refundable amount for this order.");
      return;
    }

    if (amount > remainingRefundableAmount) {
      setError(
        `Refund amount cannot exceed ₹${remainingRefundableAmount.toLocaleString(
          "en-IN",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )}.`,
      );
      return;
    }

    setError("");
    setMessage("");
    setBusy(true);

    try {
      const r = await apiClient().request<{ refundOrder: Order }>(
        adminRefundMutation,
        {
          id: o.id,
          amountInr: amount,
          reason: refundReason,
        },
      );

      setO(r.refundOrder);
      setRefund("");
      setMessage("Refund processed.");

      /*
       * Refresh after-sales data because an approved/processed
       * refund request may no longer be REQUESTED.
       */
      await loadAfterSales();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setBusy(false);
    }
  }

  async function updateAfterSales(
    request: AfterSalesRequest,
    nextStatus: "APPROVED" | "REJECTED",
  ) {
    const noteText = (adminNotes[request.id] || "").trim();

    if (nextStatus === "REJECTED" && !noteText) {
      setError("Please enter an admin note explaining the rejection.");
      return;
    }

    setError("");
    setMessage("");
    setAfterSalesBusy(true);

    try {
      await apiClient().request<{ updateReturnRequest: string }>(
        updateReturnRequestMutation,
        {
          id: request.id,
          status: nextStatus,
          adminNote: noteText || null,
        },
      );

      await loadAfterSales();

      if (nextStatus === "APPROVED") {
        setMessage(
          request.requestType === "PRODUCT_FAULT"
            ? "Product-fault request approved. Store credit has been processed."
            : "Size-replacement request approved.",
        );
      } else {
        setMessage("After-sales request rejected.");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update after-sales request.",
      );
    } finally {
      setAfterSalesBusy(false);
    }
  }

  if (loading || (busy && !o)) {
    return <main className="mx-auto max-w-6xl px-5 py-16">Loading order…</main>;
  }

  if (!user || !["ADMIN", "STAFF"].includes(user.role)) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        Admin access required.
      </main>
    );
  }

  if (!o) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16 text-red-700">
        {error || "Order not found."}
      </main>
    );
  }

  /*
   * -------------------------------------------------------
   * MANUAL REFUND AVAILABILITY
   *
   * Manual Razorpay refunds are available only when there
   * is an outstanding legacy refund request.
   *
   * Product-fault requests use store credit and therefore
   * must NOT enable the Razorpay refund control.
   * -------------------------------------------------------
   */

  const pendingRefundRequests = afterSales
    .filter(
      (request) =>
        request.status === "REQUESTED" &&
        request.requestType == null &&
        Number(request.refundAmountInr ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const pendingRefundRequest = pendingRefundRequests[0] || null;

  const requestedRefundAmount = Number(
    pendingRefundRequest?.refundAmountInr ?? 0,
  );

  const refundedAmount = o.refunds
    .filter(
      (refund: any) =>
        refund.status === "PENDING" || refund.status === "PROCESSED",
    )
    .reduce(
      (sum: number, refund: any) => sum + Number(refund.amountInr ?? 0),
      0,
    );

  const remainingRefundableAmount = Math.max(
    0,
    Math.round((requestedRefundAmount - refundedAmount) * 100) / 100,
  );

  const canIssueManualRefund =
    o.paymentStatus === "CAPTURED" &&
    pendingRefundRequest !== null &&
    remainingRefundableAmount > 0;

  const a = o.shippingAddress || {};

  const q = encodeURIComponent(
    [a.line1, a.line2, a.city, a.state, a.postalCode, a.countryCode || "IN"]
      .filter(Boolean)
      .join(", "),
  );

  const getItem = (orderItemId: string | null) => {
    if (!orderItemId) return null;
    return o.items.find((item) => item.id === orderItemId) || null;
  };

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
          {/* ITEMS */}
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
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

          {/* AFTER SALES */}
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-[#5e473c]">
                  After-Sales Requests
                </h2>

                <p className="mt-1 text-sm text-[#8b7a70]">
                  Product-fault and size-replacement requests for this order.
                </p>
              </div>

              <span className="rounded-full bg-[#f3e7d7] px-3 py-1 text-xs">
                {afterSales.length}{" "}
                {afterSales.length === 1 ? "request" : "requests"}
              </span>
            </div>

            {afterSales.length === 0 ? (
              <p className="mt-5 rounded-xl bg-[#fffaf4] p-4 text-sm text-[#8b7a70]">
                No after-sales requests for this order.
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                {afterSales.map((request) => {
                  const item = getItem(request.orderItemId);
                  const isPending = request.status === "REQUESTED";

                  const isProductFault =
                    request.requestType === "PRODUCT_FAULT";

                  return (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-[#eadfd5] bg-[#fffaf4] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#5e473c] px-3 py-1 text-xs text-white">
                              {isProductFault
                                ? "PRODUCT FAULT"
                                : "SIZE REPLACEMENT"}
                            </span>

                            <span className="rounded-full border border-[#d9cbc0] bg-white px-3 py-1 text-xs">
                              {request.status}
                            </span>
                          </div>

                          <h3 className="mt-3 font-medium text-[#5e473c]">
                            {item?.productName || "Order item"}
                          </h3>

                          {item && (
                            <p className="mt-1 text-xs text-[#8b7a70]">
                              {item.sku} · Qty {item.quantity}
                            </p>
                          )}
                        </div>

                        <div className="text-right text-sm">
                          <p className="text-xs text-[#8b7a70]">Requested</p>

                          <p>
                            {new Date(request.createdAt).toLocaleString(
                              "en-IN",
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-[#8b7a70]">Customer</p>
                          <p className="mt-1 text-sm">
                            {request.customerEmail || o.customerEmail || "-"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white p-3">
                          <p className="text-xs text-[#8b7a70]">
                            Paid amount for item
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {request.approvedCreditInr != null
                              ? `₹${Number(
                                  request.approvedCreditInr,
                                ).toLocaleString("en-IN")}`
                              : "Calculated at approval"}
                          </p>
                        </div>

                        {request.requestedSize && (
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs text-[#8b7a70]">
                              Requested size
                            </p>

                            <p className="mt-1 text-sm font-medium">
                              {request.requestedSize}
                            </p>
                          </div>
                        )}

                        {request.replacementVariantId && (
                          <div className="rounded-xl bg-white p-3">
                            <p className="text-xs text-[#8b7a70]">
                              Replacement variant
                            </p>

                            <p className="mt-1 break-all text-sm">
                              {request.replacementVariantId}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 rounded-xl bg-white p-4">
                        <p className="text-xs text-[#8b7a70]">
                          Customer reason
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                          {request.reason}
                        </p>
                      </div>

                      {request.approvedCreditInr != null && (
                        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                          <p className="text-xs text-green-700">
                            Approved store credit
                          </p>

                          <p className="mt-1 text-lg font-medium text-green-800">
                            ₹
                            {Number(request.approvedCreditInr).toLocaleString(
                              "en-IN",
                            )}
                          </p>
                        </div>
                      )}

                      {request.adminNote && (
                        <div className="mt-4 rounded-xl border border-[#eadfd5] bg-white p-4">
                          <p className="text-xs text-[#8b7a70]">Admin note</p>

                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                            {request.adminNote}
                          </p>
                        </div>
                      )}

                      {request.replacementOrderId && (
                        <div className="mt-4 rounded-xl bg-white p-4 text-sm">
                          <span className="text-[#8b7a70]">
                            Replacement order:
                          </span>{" "}
                          <span className="break-all">
                            {request.replacementOrderId}
                          </span>
                        </div>
                      )}

                      {isPending && (
                        <div className="mt-5 border-t border-[#eadfd5] pt-5">
                          <label className="block text-sm">
                            Admin note
                            <textarea
                              value={adminNotes[request.id] || ""}
                              onChange={(e) =>
                                setAdminNotes((current) => ({
                                  ...current,
                                  [request.id]: e.target.value,
                                }))
                              }
                              rows={3}
                              placeholder={
                                isProductFault
                                  ? "Optional note for approval, or explain why the request is rejected."
                                  : "Add a note about the size replacement decision."
                              }
                              className="mt-2 w-full resize-none rounded-xl border border-[#d9cbc0] bg-white px-3 py-3 text-sm outline-none focus:border-[#8b7a70]"
                            />
                          </label>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={afterSalesBusy}
                              onClick={() =>
                                void updateAfterSales(request, "APPROVED")
                              }
                              className="rounded-full bg-[#5e473c] px-5 py-3 text-sm text-white disabled:opacity-50"
                            >
                              {afterSalesBusy
                                ? "Processing…"
                                : isProductFault
                                  ? "Approve & Issue Credit"
                                  : "Approve Replacement"}
                            </button>

                            <button
                              type="button"
                              disabled={afterSalesBusy}
                              onClick={() =>
                                void updateAfterSales(request, "REJECTED")
                              }
                              className="rounded-full border border-red-200 bg-white px-5 py-3 text-sm text-red-700 disabled:opacity-50"
                            >
                              Reject Request
                            </button>
                          </div>
                        </div>
                      )}

                      {request.adminReviewedAt && (
                        <p className="mt-4 text-xs text-[#8b7a70]">
                          Reviewed{" "}
                          {new Date(request.adminReviewedAt).toLocaleString(
                            "en-IN",
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ORDER TIMELINE */}
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
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

          {/* REFUNDS */}
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-[#5e473c]">Refunds</h2>

                <p className="mt-1 text-sm text-[#8b7a70]">
                  Razorpay refunds are available only for outstanding refund
                  requests.
                </p>
              </div>

              {pendingRefundRequest && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
                  Refund requested
                </span>
              )}
            </div>

            {o.refunds.length ? (
              <div className="mt-5">
                {o.refunds.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap justify-between gap-3 border-b border-[#f0e8e2] py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{r.refundId || "Refund"}</p>

                      <p className="text-xs text-[#8b7a70]">
                        {r.status}
                        {r.createdAt
                          ? ` · ${new Date(r.createdAt).toLocaleString(
                              "en-IN",
                            )}`
                          : ""}
                      </p>

                      {r.reason && (
                        <p className="mt-1 text-xs text-[#8b7a70]">
                          {r.reason}
                        </p>
                      )}
                    </div>

                    <strong>
                      ₹
                      {Number(r.amountInr).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                ))}

                {refundedAmount > 0 && (
                  <div className="mt-4 flex justify-between text-sm">
                    <span className="text-[#8b7a70]">Already refunded</span>

                    <span className="font-medium">
                      ₹
                      {refundedAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-[#fffaf4] p-4 text-sm text-[#8b7a70]">
                No refunds yet.
              </p>
            )}

            {/* -------------------------------------------------
                PENDING REFUND REQUEST
            ------------------------------------------------- */}
            {pendingRefundRequest && (
              <div className="mt-5 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[#8b7a70]">Requested refund</span>

                  <strong>
                    ₹
                    {requestedRefundAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="text-[#8b7a70]">Already refunded</span>

                  <span>
                    ₹
                    {refundedAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="mt-3 flex justify-between gap-4 border-t border-[#eadfd5] pt-3 text-sm font-medium text-[#5e473c]">
                  <span>Remaining refundable</span>

                  <span>
                    ₹
                    {remainingRefundableAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* -------------------------------------------------
                MANUAL RAZORPAY REFUND
            ------------------------------------------------- */}
            <div className="mt-5 grid gap-3">
              <input
                type="number"
                min="0"
                max={
                  canIssueManualRefund ? remainingRefundableAmount : undefined
                }
                step="0.01"
                value={refund}
                onChange={(e) => setRefund(e.target.value)}
                placeholder={
                  canIssueManualRefund
                    ? `Maximum ₹${remainingRefundableAmount.toLocaleString(
                        "en-IN",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}`
                    : "Refund unavailable"
                }
                disabled={!canIssueManualRefund || busy}
                className="rounded-xl border border-[#d9cbc0] px-3 py-3 disabled:cursor-not-allowed disabled:bg-[#f5f0eb] disabled:text-[#9b8e86]"
              />

              <input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                disabled={!canIssueManualRefund || busy}
                className="rounded-xl border border-[#d9cbc0] px-3 py-3 disabled:cursor-not-allowed disabled:bg-[#f5f0eb] disabled:text-[#9b8e86]"
              />

              <button
                type="button"
                disabled={!canIssueManualRefund || busy}
                onClick={() => void doRefund()}
                className="rounded-full border border-red-200 px-5 py-3 text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy
                  ? "Processing…"
                  : canIssueManualRefund
                    ? "Issue Razorpay refund"
                    : "Refund unavailable"}
              </button>

              {!pendingRefundRequest && (
                <p className="text-xs leading-5 text-[#8b7a70]">
                  A manual Razorpay refund can only be issued when there is an
                  outstanding refund request for this order.
                </p>
              )}

              {pendingRefundRequest && remainingRefundableAmount <= 0 && (
                <p className="text-xs leading-5 text-green-700">
                  This refund request has already been fully refunded.
                </p>
              )}
            </div>
          </div>

          {/* DELIVERY ADDRESS */}
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
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
              className="mt-4 inline-block text-sm underline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${q}`}
            >
              Open location in Google Maps
            </a>
          </div>
        </section>

        {/* FULFILLMENT */}
        <aside className="h-fit rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-6">
          <h2 className="font-serif text-2xl text-[#5e473c]">Fulfillment</h2>

          <label className="mt-5 block text-sm">
            Order status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-3 py-3"
            >
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <div className="mt-5">
            <p className="text-sm">Payment status</p>

            <div className="mt-2 rounded-xl border border-[#d9cbc0] bg-[#f8f1eb] px-3 py-3 text-sm font-medium text-[#5e473c]">
              {o.paymentStatus === "REFUND_PENDING"
                ? "Refund pending"
                : o.paymentStatus === "REFUNDED"
                  ? "Refunded"
                  : o.paymentStatus === "REFUND_FAILED"
                    ? "Refund failed"
                    : o.paymentStatus === "PARTIALLY_REFUNDED"
                      ? "Partially refunded"
                      : o.paymentStatus === "CAPTURED"
                        ? "Captured"
                        : o.paymentStatus === "PAYMENT_FAILED"
                          ? "Payment failed"
                          : o.paymentStatus === "PAYMENT_EXPIRED"
                            ? "Payment expired"
                            : o.paymentStatus}
            </div>

            <p className="mt-2 text-xs leading-5 text-[#8b7a70]">
              Payment and refund status are managed automatically.
            </p>
          </div>

          <label className="mt-4 block text-sm">
            Carrier
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-3 py-3"
            />
          </label>

          <label className="mt-4 block text-sm">
            Tracking number
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-3 py-3"
            />
          </label>

          <label className="mt-4 block text-sm">
            Tracking URL
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-3 py-3"
            />
          </label>

          <label className="mt-4 block text-sm">
            Internal note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-3 py-3"
            />
          </label>

          <button
            disabled={busy}
            onClick={() => void save()}
            className="mt-6 w-full rounded-full bg-[#5e473c] px-5 py-3 text-sm text-white disabled:opacity-50"
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
