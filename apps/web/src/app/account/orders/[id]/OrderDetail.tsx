"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../../../lib/graphql";
import {
  myOrderQuery,
  myReturnsQuery,
  cancelMyOrderMutation,
  requestItemAfterSalesMutation,
} from "../../../../lib/orders";
import { useAuth } from "../../../../components/AuthProvider";

type OrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceInr: number;
  totalPriceInr: number;
  productId: string | null;
  variantId: string | null;
  size: string | null;
  replacementSizes: string[];
};

type O = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentReference: string | null;
  currency: string;
  subtotalInr: number;
  shippingInr: number;
  discountInr: number;
  taxInr: number;
  totalInr: number;
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippingAddress: any;
  items: OrderItem[];
};

type ReturnRequest = {
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

type AfterSalesRequestResponse = {
  id: string;
  orderId: string;
  orderItemId: string;
  requestType: string;
  requestedSize: string | null;
  calculatedPaidAmountInr: number;
  status: string;
};

type RequestType = "PRODUCT_FAULT" | "SIZE_REPLACEMENT";

export default function OrderDetail({ id }: { id: string }) {
  const { user, loading } = useAuth();

  const [o, setO] = useState<O | null>(null);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const [cancelReason, setCancelReason] = useState("");

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<RequestType>("PRODUCT_FAULT");
  const [afterSalesReason, setAfterSalesReason] = useState("");
  const [requestedSize, setRequestedSize] = useState("");
  const [afterSalesImages, setAfterSalesImages] = useState<
    {
      filename: string;
      contentType: string;
      dataBase64: string;
      previewUrl: string;
    }[]
  >([]);

  async function loadOrder() {
    const r = await apiClient().request<{ myOrder: O }>(myOrderQuery, { id });

    setO(r.myOrder);
  }

  async function loadReturns() {
    const r = await apiClient().request<{
      myReturns: ReturnRequest[];
    }>(myReturnsQuery);

    setReturns((r.myReturns || []).filter((item) => item.orderId === id));
  }

  useEffect(() => {
    if (loading || !user) return;

    setError("");

    void Promise.all([loadOrder(), loadReturns()]).catch((e) => {
      setError(e instanceof Error ? e.message : "Unable to load order.");
    });
  }, [id, loading, user]);

  const returnByItemId = useMemo(() => {
    const map = new Map<string, ReturnRequest>();

    for (const request of returns) {
      if (request.orderItemId) {
        map.set(request.orderItemId, request);
      }
    }

    return map;
  }, [returns]);

  if (loading || (!o && !error)) {
    return <main className="mx-auto max-w-5xl px-5 py-16">Loading order…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16">
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </main>
    );
  }

  if (!o) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-red-700">
        {error || "Order not found."}
      </main>
    );
  }

  const a = o.shippingAddress || {};

  const q = encodeURIComponent(
    [a.line1, a.line2, a.city, a.state, a.postalCode, a.countryCode || "IN"]
      .filter(Boolean)
      .join(", "),
  );

  const steps = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

  const idx = steps.indexOf(o.status);

  async function cancel() {
    if (!cancelReason.trim()) {
      setError("Enter a cancellation reason.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const r = await apiClient().request<{
        cancelMyOrder: O;
      }>(cancelMyOrderMutation, {
        id,
        reason: cancelReason.trim(),
      });

      setO(r.cancelMyOrder);
      setCancelReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation failed.");
    } finally {
      setBusy(false);
    }
  }

  function openAfterSales(itemId: string, type: RequestType) {
    setError("");
    setActiveItemId(itemId);
    setRequestType(type);
    setAfterSalesReason("");
    setRequestedSize("");
    setAfterSalesImages([]);
  }

  function closeAfterSales() {
    if (busy) return;

    setActiveItemId(null);
    setAfterSalesReason("");
    setRequestedSize("");
    setAfterSalesImages([]);
  }

  function handleAfterSalesImages(files: FileList | null) {
    if (!files) return;

    const selectedFiles = Array.from(files);

    if (selectedFiles.length > 3) {
      setError("You can upload a maximum of 3 images.");
      return;
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    for (const file of selectedFiles) {
      if (!allowedTypes.has(file.type)) {
        setError("Only JPG, PNG, WEBP, and GIF images are allowed.");
        return;
      }

      if (file.size > 8 * 1024 * 1024) {
        setError(`"${file.name}" is larger than the 8 MB limit.`);
        return;
      }
    }

    setError("");

    void Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<{
            filename: string;
            contentType: string;
            dataBase64: string;
            previewUrl: string;
          }>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              const result = String(reader.result ?? "");

              const commaIndex = result.indexOf(",");

              if (commaIndex === -1) {
                reject(new Error("Unable to read image."));
                return;
              }

              resolve({
                filename: file.name,
                contentType: file.type,
                dataBase64: result.slice(commaIndex + 1),
                previewUrl: result,
              });
            };

            reader.onerror = () => {
              reject(new Error(`Unable to read "${file.name}".`));
            };

            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((images) => {
        setAfterSalesImages(images);
      })
      .catch((e) => {
        setError(
          e instanceof Error
            ? e.message
            : "Unable to read the selected images.",
        );
      });
  }

  async function submitAfterSales(item: OrderItem) {
    if (!afterSalesReason.trim()) {
      setError("Please enter a reason.");
      return;
    }

    if (requestType === "PRODUCT_FAULT" && afterSalesImages.length < 1) {
      setError("Please upload at least 1 image showing the product fault.");
      return;
    }

    if (afterSalesImages.length > 3) {
      setError("You can upload a maximum of 3 images.");
      return;
    }

    if (requestType === "SIZE_REPLACEMENT" && !requestedSize.trim()) {
      setError("Enter the size you would like instead.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiClient().request<{
        requestItemAfterSales: AfterSalesRequestResponse;
      }>(requestItemAfterSalesMutation, {
        orderId: id,
        orderItemId: item.id,
        requestType,
        reason: afterSalesReason.trim(),
        requestedSize:
          requestType === "SIZE_REPLACEMENT" ? requestedSize.trim() : null,
        images:
          requestType === "PRODUCT_FAULT"
            ? afterSalesImages.map((image) => ({
                filename: image.filename,
                contentType: image.contentType,
                dataBase64: image.dataBase64,
              }))
            : [],
      });

      await loadReturns();

      setActiveItemId(null);
      setAfterSalesReason("");
      setRequestedSize("");
      setAfterSalesImages([]);

      const response = result.requestItemAfterSales;

      if (response.requestType === "PRODUCT_FAULT") {
        setSuccess(
          `Product fault request submitted. Paid amount considered: ₹${Number(
            response.calculatedPaidAmountInr,
          ).toLocaleString("en-IN")}.`,
        );
      } else {
        setSuccess(
          `Size replacement request submitted for ${response.requestedSize}.`,
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to submit after-sales request.",
      );
    } finally {
      setBusy(false);
    }
  }

  function requestStatusLabel(status: string) {
    switch (status) {
      case "REQUESTED":
        return "Under review";
      case "APPROVED":
        return "Approved";
      case "REJECTED":
        return "Rejected";
      case "CANCELLED":
        return "Cancelled";
      case "FULFILLED":
        return "Fulfilled";
      default:
        return status;
    }
  }

  function requestTypeLabel(type: string | null) {
    if (type === "PRODUCT_FAULT") {
      return "Product fault";
    }

    if (type === "SIZE_REPLACEMENT") {
      return "Size replacement";
    }

    return "After-sales request";
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
      <Link href="/account/orders" className="text-sm text-[#8b7a70]">
        ← Orders
      </Link>

      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
        {o.orderNumber}
      </h1>

      <p className="mt-2 text-sm text-[#8b7a70]">
        {new Date(o.createdAt).toLocaleString("en-IN")}
      </p>

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </p>
      )}

      <div className="mt-8 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s} className="text-center">
              <div
                className={`mx-auto h-3 w-3 rounded-full ${
                  i <= idx ? "bg-[#5e473c]" : "bg-[#d9cbc0]"
                }`}
              />

              <p className="mt-2 text-xs">{s}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 text-center text-sm text-[#8b7a70]">
          <p>Current status: {o.status}</p>

          {o.status === "CANCELLED" && o.paymentStatus === "REFUND_PENDING" && (
            <p className="mt-1">Refund status: Refund pending</p>
          )}

          {o.status === "CANCELLED" && o.paymentStatus === "REFUNDED" && (
            <p className="mt-1">Refund status: Refunded</p>
          )}

          {o.status === "CANCELLED" && o.paymentStatus === "REFUND_FAILED" && (
            <p className="mt-1 text-red-700">Refund status: Refund failed</p>
          )}

          {o.status === "CANCELLED" &&
            o.paymentStatus === "PARTIALLY_REFUNDED" && (
              <p className="mt-1">Refund status: Partially refunded</p>
            )}

          {o.status === "CANCELLED" &&
            o.paymentStatus === "CAPTURED" &&
            o.paymentReference === "STORE_CREDIT" && (
              <p className="mt-1">Payment: Store credit</p>
            )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
            <h2 className="font-serif text-2xl text-[#5e473c]">Items</h2>

            <div className="mt-2">
              {o.items.map((item) => {
                const existingRequest = returnByItemId.get(item.id);

                const isRequesting = activeItemId === item.id;

                const hasActiveRequest =
                  !!existingRequest &&
                  !["REJECTED", "CANCELLED"].includes(existingRequest.status);

                return (
                  <div
                    key={item.id}
                    className="border-b border-[#f0e8e2] py-5 last:border-b-0"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-medium">{item.productName}</p>

                        <p className="text-xs text-[#8b7a70]">
                          {item.sku} · Qty {item.quantity}
                        </p>
                      </div>

                      <span className="shrink-0">
                        ₹{Number(item.totalPriceInr).toLocaleString("en-IN")}
                      </span>
                    </div>

                    {existingRequest && (
                      <div className="mt-4 rounded-2xl bg-[#fffaf4] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[#5e473c]">
                            {requestTypeLabel(existingRequest.requestType)}
                          </p>

                          <span className="rounded-full bg-white px-3 py-1 text-xs text-[#8b7a70]">
                            {requestStatusLabel(existingRequest.status)}
                          </span>
                        </div>

                        {existingRequest.requestedSize && (
                          <p className="mt-2 text-xs text-[#8b7a70]">
                            Requested size:{" "}
                            <strong>{existingRequest.requestedSize}</strong>
                          </p>
                        )}

                        {existingRequest.approvedCreditInr != null && (
                          <p className="mt-2 text-xs text-[#8b7a70]">
                            Approved store credit: ₹
                            {Number(
                              existingRequest.approvedCreditInr,
                            ).toLocaleString("en-IN")}
                          </p>
                        )}

                        {existingRequest.adminNote && (
                          <p className="mt-2 text-xs text-[#8b7a70]">
                            Note: {existingRequest.adminNote}
                          </p>
                        )}
                      </div>
                    )}

                    {o.status === "DELIVERED" &&
                      !hasActiveRequest &&
                      !isRequesting && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openAfterSales(item.id, "PRODUCT_FAULT")
                            }
                            className="rounded-full border border-[#d9cbc0] px-4 py-2 text-xs text-[#5e473c] transition hover:bg-[#fffaf4]"
                          >
                            Product fault
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openAfterSales(item.id, "SIZE_REPLACEMENT")
                            }
                            className="rounded-full bg-[#5e473c] px-4 py-2 text-xs text-white transition hover:opacity-90"
                          >
                            Size replacement
                          </button>
                        </div>
                      )}

                    {isRequesting && (
                      <div className="mt-4 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-serif text-xl text-[#5e473c]">
                              {requestType === "PRODUCT_FAULT"
                                ? "Report a product fault"
                                : "Request a size replacement"}
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-[#8b7a70]">
                              {requestType === "PRODUCT_FAULT"
                                ? "Tell us what is wrong with the product. Your request will be reviewed by our team."
                                : "Enter the replacement size you would like. Availability will be checked before approval."}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={closeAfterSales}
                            className="text-lg text-[#8b7a70]"
                            aria-label="Close"
                          >
                            ×
                          </button>
                        </div>

                        {requestType === "SIZE_REPLACEMENT" && (
                          <div className="mt-4">
                            <label className="text-xs font-medium text-[#5e473c]">
                              Replacement size
                            </label>

                            {item.replacementSizes.length > 0 ? (
                              <select
                                value={requestedSize}
                                onChange={(e) =>
                                  setRequestedSize(e.target.value)
                                }
                                className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white p-3 text-sm outline-none focus:border-[#8b7a70]"
                              >
                                <option value="">
                                  Select replacement size
                                </option>

                                {item.replacementSizes.map((size) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="mt-2 rounded-xl bg-white p-3 text-sm text-[#8b7a70]">
                                No other sizes are currently available.
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-4">
                          <label className="text-xs font-medium text-[#5e473c]">
                            Reason
                          </label>

                          <textarea
                            value={afterSalesReason}
                            onChange={(e) =>
                              setAfterSalesReason(e.target.value)
                            }
                            placeholder={
                              requestType === "PRODUCT_FAULT"
                                ? "Describe the fault, damage, or problem with the product."
                                : "Tell us why you need a different size."
                            }
                            className="mt-2 min-h-28 w-full rounded-xl border border-[#d9cbc0] bg-white p-3 text-sm outline-none focus:border-[#8b7a70]"
                          />
                        </div>

                        {requestType === "PRODUCT_FAULT" && (
                          <div className="mt-4">
                            <label className="text-xs font-medium text-[#5e473c]">
                              Photos of the product fault
                            </label>

                            <p className="mt-1 text-xs text-[#8b7a70]">
                              Upload 1–3 clear photos showing the problem. JPG,
                              PNG, WEBP or GIF, up to 8 MB each.
                            </p>

                            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#d9cbc0] bg-[#fffaf4] px-4 py-6 text-sm text-[#5e473c] transition hover:bg-[#fcf8f3]">
                              <span>
                                {afterSalesImages.length === 0
                                  ? "Choose photos"
                                  : "Replace photos"}
                              </span>

                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                multiple
                                className="hidden"
                                disabled={busy}
                                onChange={(e) => {
                                  handleAfterSalesImages(e.target.files);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>

                            {afterSalesImages.length > 0 && (
                              <div className="mt-4 grid grid-cols-3 gap-3">
                                {afterSalesImages.map((image, index) => (
                                  <div
                                    key={`${image.filename}-${index}`}
                                    className="relative overflow-hidden rounded-xl border border-[#eadfd5] bg-white"
                                  >
                                    <img
                                      src={image.previewUrl}
                                      alt={`Fault photo ${index + 1}`}
                                      className="aspect-square w-full object-cover"
                                    />

                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => {
                                        setAfterSalesImages((current) =>
                                          current.filter(
                                            (_, imageIndex) =>
                                              imageIndex !== index,
                                          ),
                                        );
                                      }}
                                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm text-[#5e473c] shadow-sm hover:bg-white disabled:opacity-50"
                                      aria-label={`Remove photo ${index + 1}`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              busy ||
                              (requestType === "SIZE_REPLACEMENT" &&
                                item.replacementSizes.length === 0)
                            }
                            onClick={() => void submitAfterSales(item)}
                            className="rounded-full bg-[#5e473c] px-5 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? "Submitting…" : "Submit request"}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={closeAfterSales}
                            className="rounded-full border border-[#d9cbc0] px-5 py-3 text-sm text-[#5e473c] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{Number(o.subtotalInr).toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between">
                <span>Shipping</span>
                <span>₹{Number(o.shippingInr).toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between">
                <span>Tax</span>
                <span>₹{Number(o.taxInr).toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between">
                <span>Discount</span>
                <span>- ₹{Number(o.discountInr).toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between border-t pt-3 font-medium">
                <span>Total</span>
                <span>₹{Number(o.totalInr).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {o.trackingNumber && (
              <div className="mt-6 rounded-xl bg-[#fffaf4] p-4 text-sm">
                <strong>{o.carrier || "Carrier"}</strong>
                {" · "}
                {o.trackingNumber}

                {o.trackingUrl && (
                  <a
                    href={o.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 underline"
                  >
                    Track shipment
                  </a>
                )}
              </div>
            )}
          </div>

          {["PAID", "PROCESSING"].includes(o.status) && !o.trackingNumber && (
            <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
              <h2 className="font-serif text-2xl text-[#5e473c]">
                Cancel order
              </h2>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why would you like to cancel?"
                className="mt-4 min-h-24 w-full rounded-xl border border-[#d9cbc0] p-3"
              />

              <button
                disabled={busy}
                onClick={() => void cancel()}
                className="mt-3 rounded-full border border-red-200 px-5 py-3 text-sm text-red-700 disabled:opacity-50"
              >
                {busy ? "Processing…" : "Cancel order & request refund"}
              </button>
            </div>
          )}
        </section>

        <aside className="rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-6">
          <h2 className="font-serif text-2xl text-[#5e473c]">Delivery</h2>

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
          </p>

          <a
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${q}`}
            className="mt-4 inline-block text-sm underline"
          >
            View delivery location on Google Maps
          </a>
        </aside>
      </div>
    </main>
  );
}
