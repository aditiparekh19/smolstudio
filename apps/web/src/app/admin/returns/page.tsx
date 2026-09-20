"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import {
  adminReturnsQuery,
  updateReturnRequestMutation,
} from "../../../lib/orders";
import { useAuth } from "../../../components/AuthProvider";
export default function Returns() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("REQUESTED");
  const [error, setError] = useState("");
  const [trackingNumbers, setTrackingNumbers] = useState<
    Record<string, string>
  >({});
  async function load() {
    try {
      setRows(
        (await apiClient().request<any>(adminReturnsQuery, { status }))
          .adminReturns,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load returns.");
    }
  }
  useEffect(() => {
    if (!loading && user) void load();
  }, [loading, user, status]);
  if (loading)
    return <main className="mx-auto max-w-6xl px-5 py-16">Loading…</main>;
  if (!user || !["ADMIN", "STAFF"].includes(user.role))
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        Admin access required.
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <Link href="/admin" className="text-sm text-[#8b7a70]">
        ← Back office
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Returns</h1>
      <div className="mt-6 flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-[#d9cbc0] px-4 py-3"
        >
          <option>REQUESTED</option>
          <option>PROCESSING</option>
          <option>COMPLETED</option>
          <option>REJECTED</option>
          <option>CANCELLED</option>
        </select>
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 divide-y divide-[#eadfd5] rounded-4xl border border-[#eadfd5] bg-white">
        {rows.length === 0 ? (
          <p className="p-6 text-[#8b7a70]">No requests.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1">
                  <p className="font-medium">{r.orderNumber}</p>
                  <p className="text-xs text-[#8b7a70]">
                    {r.customerEmail} · ₹{r.refundAmountInr}
                  </p>
                </div>
                <span className="rounded-full bg-[#f3ebe4] px-3 py-1 text-xs font-medium text-[#5e473c]">
                  {r.status === "REQUESTED"
                    ? "Requested"
                    : r.status === "COMPLETED"
                      ? "Completed"
                      : r.status === "REJECTED"
                        ? "Rejected"
                        : r.status === "CANCELLED"
                          ? "Cancelled"
                          : r.reviewedAt
                            ? "Reviewed"
                            : r.receivedAt
                              ? "Received"
                              : r.pickedUpAt
                                ? "Picked up"
                                : "Processing"}
                </span>
              </div>
              <p className="mt-3 text-sm">{r.reason}</p>

              {r.pickupTrackingNumber && (
                <p className="mt-2 text-xs text-[#8b7a70]">
                  Delhivery AWB:{" "}
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
                    The original item has been reviewed and the replacement
                    order has been created. The replacement can now be shipped
                    to the customer.
                  </p>

                  <Link
                    href={`/admin/orders/${r.replacementOrderId}`}
                    className="mt-3 inline-flex rounded-full bg-[#5e473c] px-4 py-2 text-xs text-white transition hover:bg-[#46352d]"
                  >
                    Open replacement order →
                  </Link>
                </div>
              )}

              {r.requestType === "PRODUCT_FAULT" && r.images?.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#8b7a70]">
                    Product fault photos ({r.images.length})
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {r.images.map((image: any) => (
                      <a
                        key={image.id}
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-2xl border border-[#eadfd5] bg-[#fffaf4]"
                      >
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />

                        <p className="truncate px-3 py-2 text-xs text-[#8b7a70]">
                          {image.filename}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {r.status === "REQUESTED" && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={async () => {
                      await apiClient().request(updateReturnRequestMutation, {
                        id: r.id,
                        status: "APPROVED",
                        adminNote: "Approved by admin",
                      });
                      await load();
                    }}
                    className="rounded-full bg-[#5e473c] px-4 py-2 text-sm text-white"
                  >
                    Approve & process
                  </button>
                  <button
                    onClick={async () => {
                      await apiClient().request(updateReturnRequestMutation, {
                        id: r.id,
                        status: "REJECTED",
                        adminNote: "Return rejected",
                      });
                      await load();
                    }}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
              {r.status === "PROCESSING" && !r.pickedUpAt && (
                <div className="mt-5 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                  <p className="text-sm font-medium text-[#5e473c]">
                    Delhivery pickup
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#8b7a70]">
                    Enter the Delhivery AWB/tracking number when the item has
                    been collected.
                  </p>

                  <input
                    type="text"
                    value={trackingNumbers[r.id] ?? ""}
                    onChange={(e) =>
                      setTrackingNumbers((current) => ({
                        ...current,
                        [r.id]: e.target.value,
                      }))
                    }
                    placeholder="Delhivery AWB / tracking number"
                    className="mt-3 w-full rounded-full border border-[#d9cbc0] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b7a70]"
                  />
                </div>
              )}
              {r.status === "PROCESSING" && !r.pickedUpAt && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const trackingNumber = trackingNumbers[r.id]?.trim();

                      if (!trackingNumber) {
                        setError(
                          "Please enter the Delhivery AWB/tracking number.",
                        );
                        return;
                      }

                      try {
                        setError("");

                        await apiClient().request(updateReturnRequestMutation, {
                          id: r.id,
                          status: "PICKED_UP",
                          adminNote: "Item picked up by Delhivery",
                          pickupTrackingNumber: trackingNumber,
                        });

                        await load();
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Unable to mark the item as picked up.",
                        );
                      }
                    }}
                    className="rounded-full bg-[#5e473c] px-4 py-2 text-sm text-white transition hover:bg-[#46352d]"
                  >
                    Mark picked up
                  </button>
                </div>
              )}
              {r.status === "PROCESSING" && r.pickedUpAt && !r.receivedAt && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError("");

                        await apiClient().request(updateReturnRequestMutation, {
                          id: r.id,
                          status: "RECEIVED",
                          adminNote: "Item received by admin",
                        });

                        await load();
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Unable to mark the item as received.",
                        );
                      }
                    }}
                    className="rounded-full bg-[#5e473c] px-4 py-2 text-sm text-white transition hover:bg-[#46352d]"
                  >
                    Mark received
                  </button>
                </div>
              )}
              {r.status === "PROCESSING" && r.receivedAt && !r.reviewedAt && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError("");

                        await apiClient().request(updateReturnRequestMutation, {
                          id: r.id,
                          status: "REVIEWED",
                          adminNote: "Item reviewed by admin",
                        });

                        await load();
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Unable to mark the item as reviewed.",
                        );
                      }
                    }}
                    className="rounded-full bg-[#5e473c] px-4 py-2 text-sm text-white transition hover:bg-[#46352d]"
                  >
                    Mark reviewed
                  </button>
                </div>
              )}
              {r.status === "PROCESSING" &&
                r.reviewedAt &&
                r.requestType !== "SIZE_REPLACEMENT" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setError("");

                          await apiClient().request(
                            updateReturnRequestMutation,
                            {
                              id: r.id,
                              status: "COMPLETED",
                              adminNote:
                                r.requestType === "PRODUCT_FAULT"
                                  ? "Product fault return completed and store credit issued"
                                  : "Return completed",
                            },
                          );

                          await load();
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Unable to complete the return.",
                          );
                        }
                      }}
                      className="rounded-full bg-[#5e473c] px-4 py-2 text-sm text-white transition hover:bg-[#46352d]"
                    >
                      Complete return
                    </button>
                  </div>
                )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
