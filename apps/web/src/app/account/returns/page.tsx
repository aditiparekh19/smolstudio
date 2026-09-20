"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import { myReturnsQuery } from "../../../lib/orders";
import { useAuth } from "../../../components/AuthProvider";
export default function Returns() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (loading || !user) return;
    void apiClient()
      .request<any>(myReturnsQuery)
      .then((r) => setRows(r.myReturns))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load returns."),
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
    <main className="mx-auto max-w-4xl px-5 py-14">
      <Link href="/account" className="text-sm text-[#8b7a70]">
        ← Account
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Returns</h1>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-8 divide-y divide-[#eadfd5] rounded-4xl border border-[#eadfd5] bg-white">
        {rows.length === 0 ? (
          <p className="p-7 text-[#8b7a70]">No return requests.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-6">
              <div className="flex justify-between gap-4">
                <Link
                  href={`/account/orders/${r.orderId}`}
                  className="font-medium underline"
                >
                  {r.orderNumber}
                </Link>
                <span className="rounded-full bg-[#f3ebe4] px-3 py-1 text-xs font-medium text-[#5e473c]">
                  {r.status === "REQUESTED"
                    ? "Request submitted"
                    : r.status === "COMPLETED"
                      ? "Completed"
                      : r.status === "REJECTED"
                        ? "Rejected"
                        : r.status === "CANCELLED"
                          ? "Cancelled"
                          : r.requestType === "SIZE_REPLACEMENT" &&
                              r.replacementOrderId
                            ? "Replacement order created"
                            : r.reviewedAt
                              ? "Reviewed"
                              : r.receivedAt
                                ? "Item received"
                                : r.pickedUpAt
                                  ? "Picked up"
                                  : "Processing"}
                </span>
              </div>
              <p className="mt-3 text-sm">{r.reason}</p>
              {r.pickupTrackingNumber && (
                <p className="mt-2 text-xs text-[#8b7a70]">
                  Delhivery tracking:{" "}
                  <span className="font-medium text-[#5e473c]">
                    {r.pickupTrackingNumber}
                  </span>
                </p>
              )}
              {r.requestType === "SIZE_REPLACEMENT" && r.replacementOrderId && (
                <div className="mt-3 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                  <p className="text-sm font-medium text-[#5e473c]">
                    Replacement order created
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#8b7a70]">
                    Your original item has been received and reviewed. Your
                    replacement order is now being processed.
                  </p>

                  <Link
                    href={`/account/orders/${r.replacementOrderId}`}
                    className="mt-3 inline-flex rounded-full bg-[#5e473c] px-4 py-2 text-xs text-white transition hover:bg-[#46352d]"
                  >
                    View replacement order →
                  </Link>
                </div>
              )}
              {(r.processingAt ||
                r.pickedUpAt ||
                r.receivedAt ||
                r.reviewedAt ||
                r.completedAt) && (
                <div className="mt-4 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#8b7a70]">
                    Return timeline
                  </p>

                  <div className="mt-3 space-y-2 text-xs text-[#6d5b51]">
                    {r.processingAt && (
                      <p>
                        Approved: {new Date(r.processingAt).toLocaleString()}
                      </p>
                    )}

                    {r.pickedUpAt && (
                      <p>
                        Picked up: {new Date(r.pickedUpAt).toLocaleString()}
                      </p>
                    )}

                    {r.receivedAt && (
                      <p>
                        Item received: {new Date(r.receivedAt).toLocaleString()}
                      </p>
                    )}

                    {r.reviewedAt && (
                      <p>
                        Item reviewed: {new Date(r.reviewedAt).toLocaleString()}
                      </p>
                    )}

                    {r.completedAt && (
                      <p>
                        Completed: {new Date(r.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-[#8b7a70]">
                Requested {new Date(r.createdAt).toLocaleString("en-IN")}
                {r.refundAmountInr ? ` · Refund ₹${r.refundAmountInr}` : ""}
              </p>
              {r.adminNote && (
                <p className="mt-3 text-sm text-[#8b7a70]">{r.adminNote}</p>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
