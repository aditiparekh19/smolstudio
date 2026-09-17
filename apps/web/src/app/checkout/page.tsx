"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useCart } from "../../components/CartProvider";
import { apiClient } from "../../lib/graphql";
import {
  checkoutTotalsQuery,
  createPaymentOrderMutation,
  verifyPaymentMutation,
  myAddressesQuery,
} from "../../lib/orders";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Address = {
  id?: string;
  label?: string | null;
  recipientName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  phone?: string | null;
  countryCode?: string;
};

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, refresh: refreshCart } = useCart();
  const router = useRouter();

  const [address, setAddress] = useState<Address>({
    recipientName: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    phone: "",
    countryCode: "IN",
  });

  const [addresses, setAddresses] = useState<Address[]>([]);

  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState("");

  const [totals, setTotals] = useState<any>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const mapQuery = useMemo(
    () =>
      encodeURIComponent(
        [
          address.line1,
          address.line2,
          address.city,
          address.state,
          address.postalCode,
          address.countryCode,
        ]
          .filter(Boolean)
          .join(", "),
      ),
    [address],
  );

  /*
   * ============================================================
   * BROWSER DEBUG — CHECKOUT STATE
   * ============================================================
   */
  useEffect(() => {
    console.log("========== CHECKOUT STATE ==========");
    console.log("[CHECKOUT] user:", user);
    console.log("[CHECKOUT] items.length:", items.length);
    console.log("[CHECKOUT] coupon input:", coupon);
    console.log("[CHECKOUT] appliedCoupon:", appliedCoupon);
    console.log("[CHECKOUT] totals:", totals);
    console.log("====================================");
  }, [user, items.length, coupon, appliedCoupon, totals]);

  /*
   * Load Razorpay
   */
  useEffect(() => {
    console.log("[RAZORPAY] Checking Razorpay script");

    if (!document.querySelector("script[data-razorpay]")) {
      console.log("[RAZORPAY] Adding Razorpay script");

      const s = document.createElement("script");

      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.dataset.razorpay = "1";

      document.body.appendChild(s);
    } else {
      console.log("[RAZORPAY] Razorpay script already exists");
    }
  }, []);

  /*
   * Load saved addresses
   */
  useEffect(() => {
    if (!user) return;

    console.log("========== LOAD ADDRESSES ==========");
    console.log("[ADDRESS] Loading saved addresses");
    console.log("[ADDRESS] User:", user);
    console.log("====================================");

    void apiClient()
      .request<any>(myAddressesQuery)
      .then((r) => {
        console.log("[ADDRESS] Saved addresses response:", r);
        console.log("[ADDRESS] Addresses:", r.myAddresses);

        setAddresses(r.myAddresses || []);

        if (r.myAddresses?.[0]) {
          console.log("[ADDRESS] Selecting first saved address:", r.myAddresses[0]);
          setAddress(r.myAddresses[0]);
        }
      })
      .catch((err) => {
        console.error("[ADDRESS] Failed to load addresses:", err);
      });
  }, [user]);

  /*
   * ============================================================
   * Calculate checkout totals
   * ============================================================
   *
   * IMPORTANT:
   * This is the browser-side diagnostic section.
   *
   * We want to prove:
   *
   * coupon input
   *      ↓
   * appliedCoupon
   *      ↓
   * GraphQL variables
   *      ↓
   * checkoutTotals response
   *
   * ============================================================
   */
  useEffect(() => {
    console.log("");
    console.log("==============================================");
    console.log("CHECKOUT TOTALS EFFECT");
    console.log("==============================================");

    console.log("[CHECKOUT TOTALS] user exists:", !!user);
    console.log("[CHECKOUT TOTALS] items.length:", items.length);
    console.log("[CHECKOUT TOTALS] coupon input:", coupon);
    console.log("[CHECKOUT TOTALS] appliedCoupon:", appliedCoupon);

    if (!user || !items.length) {
      console.log(
        "[CHECKOUT TOTALS] SKIPPED because user/cart is not ready",
      );

      return;
    }

    console.log("[CHECKOUT TOTALS] Scheduling request in 250ms...");

    const t = setTimeout(() => {
      const variables = {
        couponCode: appliedCoupon || undefined,
      };

      console.log("");
      console.log("==============================================");
      console.log("SENDING CHECKOUT TOTALS REQUEST");
      console.log("==============================================");

      console.log("[CHECKOUT TOTALS] GraphQL query:");
      console.log(checkoutTotalsQuery);

      console.log("[CHECKOUT TOTALS] Variables:", variables);

      console.log(
        "[CHECKOUT TOTALS] couponCode:",
        variables.couponCode,
      );

      console.log(
        "[CHECKOUT TOTALS] couponCode JSON:",
        JSON.stringify(variables.couponCode),
      );

      console.log("==============================================");

      void apiClient()
        .request<any>(checkoutTotalsQuery, variables)
        .then((r) => {
          console.log("");
          console.log("==============================================");
          console.log("CHECKOUT TOTALS SUCCESS");
          console.log("==============================================");

          console.log("[CHECKOUT TOTALS] Full response:", r);

          console.log(
            "[CHECKOUT TOTALS] checkoutTotals:",
            r.checkoutTotals,
          );

          console.log(
            "[CHECKOUT TOTALS] subtotalInr:",
            r.checkoutTotals?.subtotalInr,
          );

          console.log(
            "[CHECKOUT TOTALS] discountInr:",
            r.checkoutTotals?.discountInr,
          );

          console.log(
            "[CHECKOUT TOTALS] taxInr:",
            r.checkoutTotals?.taxInr,
          );

          console.log(
            "[CHECKOUT TOTALS] shippingInr:",
            r.checkoutTotals?.shippingInr,
          );

          console.log(
            "[CHECKOUT TOTALS] totalInr:",
            r.checkoutTotals?.totalInr,
          );

          console.log("==============================================");

          setTotals(r.checkoutTotals);

          setCouponError("");
          setError("");
        })

        .catch((err: any) => {
          console.log("");
          console.log("==============================================");
          console.log("CHECKOUT TOTALS ERROR");
          console.log("==============================================");

          console.error("[CHECKOUT TOTALS] Full error:", err);

          console.error(
            "[CHECKOUT TOTALS] Error response:",
            err?.response,
          );

          console.error(
            "[CHECKOUT TOTALS] Response data:",
            err?.response?.data,
          );

          console.error(
            "[CHECKOUT TOTALS] GraphQL errors:",
            err?.response?.errors,
          );

          console.error(
            "[CHECKOUT TOTALS] Error message:",
            err?.message,
          );

          const graphqlMessage =
            err?.response?.errors?.[0]?.message ||
            err?.response?.data?.errors?.[0]?.message ||
            err?.message ||
            "Unable to calculate checkout total.";

          console.error(
            "[CHECKOUT TOTALS] Final GraphQL message:",
            graphqlMessage,
          );

          const isCouponError =
            graphqlMessage.toLowerCase().includes("coupon") ||
            graphqlMessage.toLowerCase().includes("welcome5");

          console.log(
            "[CHECKOUT TOTALS] Is coupon error:",
            isCouponError,
          );

          console.log("==============================================");

          if (isCouponError) {
            setCouponError(graphqlMessage);
            setError("");
          } else {
            setError(graphqlMessage);
            setCouponError("");
          }
        });
    }, 250);

    return () => {
      console.log(
        "[CHECKOUT TOTALS] Cancelling scheduled totals request",
      );

      clearTimeout(t);
    };
  }, [appliedCoupon, user, items.length, coupon]);

  /*
   * Empty cart
   */
  if (!items.length) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-serif text-5xl text-[#5e473c]">
          Checkout
        </h1>

        <p className="mt-4 text-[#8b7a70]">
          Your bag is empty.
        </p>

        <Link href="/" className="mt-6 inline-block underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  /*
   * User must be logged in
   */
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-serif text-5xl text-[#5e473c]">
          Checkout
        </h1>

        <p className="mt-4 text-[#8b7a70]">
          Please sign in before checkout.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-[#5e473c] px-6 py-3 text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  function validatePhone(phone: string) {
    const value = phone.trim();

    if (!value) {
      return "Phone number is required.";
    }

    if (!/^[6-9]\d{9}$/.test(value)) {
      return "Enter a valid 10-digit mobile number.";
    }

    return "";
  }

  /*
   * Submit order / open Razorpay
   */
  async function submit(e: FormEvent) {
    e.preventDefault();

    console.log("");
    console.log("==============================================");
    console.log("SUBMIT CHECKOUT");
    console.log("==============================================");

    console.log("[SUBMIT] coupon input:", coupon);
    console.log("[SUBMIT] appliedCoupon:", appliedCoupon);

    console.log("[SUBMIT] Address:", address);

    console.log(
      "[SUBMIT] Coupon being sent to createPaymentOrder:",
      appliedCoupon || null,
    );

    const phoneValidationError = validatePhone(address.phone || "");

    if (phoneValidationError) {
      console.log("[SUBMIT] Phone validation failed:", phoneValidationError);

      setPhoneError(phoneValidationError);
      setError("");
      return;
    }

    setPhoneError("");
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const paymentVariables = {
        ...address,

        /*
         * IMPORTANT:
         * Use appliedCoupon, not the raw input value.
         */
        couponCode: appliedCoupon || null,
      };

      console.log("");
      console.log("==============================================");
      console.log("CREATE PAYMENT ORDER REQUEST");
      console.log("==============================================");

      console.log(
        "[PAYMENT ORDER] Variables:",
        paymentVariables,
      );

      console.log(
        "[PAYMENT ORDER] Coupon:",
        paymentVariables.couponCode,
      );

      console.log("==============================================");

      const r = await apiClient().request<any>(
        createPaymentOrderMutation,
        paymentVariables,
      );

      console.log("");
      console.log("==============================================");
      console.log("CREATE PAYMENT ORDER SUCCESS");
      console.log("==============================================");

      console.log("[PAYMENT ORDER] Full response:", r);

      console.log(
        "[PAYMENT ORDER] createPaymentOrder:",
        r.createPaymentOrder,
      );

      console.log(
        "[PAYMENT ORDER] Order ID:",
        r.createPaymentOrder?.orderId,
      );

      console.log(
        "[PAYMENT ORDER] Order number:",
        r.createPaymentOrder?.orderNumber,
      );

      console.log("==============================================");

      if (!window.Razorpay) {
        throw new Error(
          "Payment checkout is still loading. Please wait a moment and try again.",
        );
      }

      const options = {
        key: r.createPaymentOrder.keyId,

        amount: r.createPaymentOrder.amount,

        currency: r.createPaymentOrder.currency,

        name: "SmolStudio",

        description: `Order ${r.createPaymentOrder.orderNumber}`,

        order_id: r.createPaymentOrder.razorpayOrderId,

        prefill: {
          name: address.recipientName,
          email: user?.email ?? "",
          contact: address.phone,
        },

        theme: {
          color: "#5e473c",
        },

        handler: async (response: any) => {
          try {
            setBusy(true);
            setError("");

            console.log(
              "VERIFYING PAYMENT FOR ORDER:",
              r.createPaymentOrder.orderId,
            );

            await apiClient().request<any>(verifyPaymentMutation, {
              orderId: r.createPaymentOrder.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            const orderId = r.createPaymentOrder.orderId;

            console.log("========== CHECKOUT REDIRECT ==========");
            console.log(
              "createPaymentOrder response:",
              r.createPaymentOrder,
            );
            console.log("ORDER ID:", orderId);
            console.log("========================================");

            if (!orderId || orderId === "undefined") {
              throw new Error(
                "Payment succeeded, but the server did not return a valid order ID.",
              );
            }

            await refreshCart();

            router.push(`/account/orders/${orderId}`);

            // Backend clears the paid order's cart.
            // Refresh frontend cart state so the bag becomes empty immediately.
            await refreshCart();

            // IMPORTANT:
            // Use the original orderId returned by createPaymentOrder.
            // Do NOT use verified.verifyPayment.id.
            router.push(
              `/account/orders/${r.createPaymentOrder.orderId}`,
            );
          } catch (err: any) {
            console.error("VERIFY PAYMENT ERROR:", err);

            const graphqlMessage =
              err?.response?.errors?.[0]?.message ||
              err?.message ||
              "Payment verification failed. Please contact support.";

            setError(graphqlMessage);
            setBusy(false);
          }
        },

        modal: {
          ondismiss: () => setBusy(false),
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", (response: any) => {
        console.error(
          "[RAZORPAY] Payment failed:",
          response,
        );

        setError(
          response?.error?.description ||
            "Payment failed. You can try again.",
        );

        setBusy(false);
      });

      checkout.open();
    } catch (err: any) {
      console.log("");
      console.log("==============================================");
      console.log("CREATE PAYMENT ORDER ERROR");
      console.log("==============================================");

      console.error("[PAYMENT ORDER] Full error:", err);

      console.error(
        "[PAYMENT ORDER] Response:",
        err?.response,
      );

      console.error(
        "[PAYMENT ORDER] GraphQL errors:",
        err?.response?.errors,
      );

      console.error(
        "[PAYMENT ORDER] Message:",
        err?.message,
      );

      const graphqlMessage =
        err?.response?.errors?.[0]?.message ||
        err?.message ||
        "Unable to place order.";

      console.error(
        "[PAYMENT ORDER] Final message:",
        graphqlMessage,
      );

      console.log("==============================================");

      const isCouponError =
        graphqlMessage === "Invalid coupon code." ||
        graphqlMessage.toLowerCase().includes("coupon") ||
        graphqlMessage.toLowerCase().includes("welcome5");

      if (isCouponError) {
        setCouponError(graphqlMessage);
        setError("");
      } else {
        setError(graphqlMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-14 lg:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
        Checkout
      </p>

      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
        Almost there.
      </h1>

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

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form
          onSubmit={submit}
          className="rounded-[2rem] border border-[#eadfd5] bg-white p-7"
        >
          <h2 className="font-serif text-2xl text-[#5e473c]">
            Delivery details
          </h2>

          {addresses.length > 0 && (
            <label className="mt-5 block text-sm">
              Saved address

              <select
                className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-4 py-3"
                onChange={(e) => {
                  const a = addresses.find(
                    (x) => x.id === e.target.value,
                  );

                  if (a) {
                    setAddress(a);
                  }
                }}
                defaultValue={addresses[0]?.id}
              >
                <option value="">New address</option>

                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || a.recipientName} — {a.city}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["recipientName", "Full name"],
              ["phone", "Phone"],
              ["line1", "Address line 1"],
              ["line2", "Address line 2"],
              ["city", "City"],
              ["state", "State"],
              ["postalCode", "PIN code"],
            ].map(([key, label]) => (
              <label
                key={key}
                className={
                  key === "line1" || key === "line2"
                    ? "sm:col-span-2 text-sm"
                    : "text-sm"
                }
              >
                {label}

                <input
                  required={key !== "line2"}
                  type={key === "phone" ? "tel" : "text"}
                  inputMode={
                    key === "phone" ? "numeric" : undefined
                  }
                  maxLength={key === "phone" ? 10 : undefined}
                  value={(address as any)[key] || ""}
                  onChange={(e) => {
                    let value = e.target.value;

                    if (key === "phone") {
                      value = value
                        .replace(/\D/g, "")
                        .slice(0, 10);

                      if (phoneError) {
                        setPhoneError(validatePhone(value));
                      }
                    }

                    setAddress({
                      ...address,
                      [key]: value,
                    });
                  }}
                  className={`mt-2 w-full rounded-xl border px-4 py-3 ${
                    key === "phone" && phoneError
                      ? "border-red-400"
                      : "border-[#d9cbc0]"
                  }`}
                />

                {key === "phone" && phoneError && (
                  <p className="mt-1 text-sm text-red-600">
                    {phoneError}
                  </p>
                )}
              </label>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-[#fffaf4] p-4">
            <p className="text-sm font-medium text-[#5e473c]">
              Delivery location
            </p>

            {mapKey ? (
              <iframe
                title="Delivery map"
                className="mt-3 h-56 w-full rounded-xl border-0"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
                  mapKey,
                )}&q=${mapQuery}`}
              />
            ) : (
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                className="mt-2 inline-block text-sm underline"
              >
                Preview this address in Google Maps
              </a>
            )}
          </div>

          <button
            disabled={busy}
            className="mt-6 w-full rounded-full bg-[#5e473c] px-6 py-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? "Opening secure payment…"
              : "Pay securely with Razorpay"}
          </button>

          <p className="mt-3 text-xs leading-5 text-[#8b7a70]">
            Inventory is reserved for a short payment window and
            released automatically if payment fails or expires.
          </p>
        </form>

        <aside className="h-fit rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
            Order summary
          </p>

          {items.map((i) => (
            <div
              key={i.id}
              className="mt-4 flex justify-between gap-4 text-sm"
            >
              <span>
                {i.name} × {i.quantity}
              </span>

              <span>
                ₹{i.totalInr.toLocaleString("en-IN")}
              </span>
            </div>
          ))}

          <label className="mt-6 block text-sm">
            Coupon code

            <div className="mt-2 flex gap-2">
              <input
                value={coupon}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();

                  console.log(
                    "[COUPON INPUT] User typed:",
                    e.target.value,
                  );

                  console.log(
                    "[COUPON INPUT] Normalized:",
                    value,
                  );

                  setCoupon(value);

                  /*
                   * Clear coupon error while typing.
                   */
                  setCouponError("");
                }}
                placeholder="WELCOME5"
                className="min-w-0 flex-1 rounded-xl border border-[#d9cbc0] px-3 py-3"
              />

              <button
                type="button"
                onClick={() => {
                  const normalizedCoupon = coupon
                    .trim()
                    .toUpperCase();

                  console.log("");
                  console.log(
                    "==============================================",
                  );
                  console.log("COUPON APPLY CLICKED");
                  console.log(
                    "==============================================",
                  );

                  console.log(
                    "[COUPON APPLY] Raw input:",
                    coupon,
                  );

                  console.log(
                    "[COUPON APPLY] Trimmed:",
                    coupon.trim(),
                  );

                  console.log(
                    "[COUPON APPLY] Normalized:",
                    normalizedCoupon,
                  );

                  console.log(
                    "[COUPON APPLY] Previous appliedCoupon:",
                    appliedCoupon,
                  );

                  console.log(
                    "[COUPON APPLY] Setting appliedCoupon to:",
                    normalizedCoupon,
                  );

                  console.log(
                    "==============================================",
                  );

                  /*
                   * Clear previous errors before
                   * applying the new coupon.
                   */
                  setCouponError("");
                  setError("");

                  setAppliedCoupon(normalizedCoupon);
                }}
                className="rounded-xl bg-[#5e473c] px-5 py-3 text-sm font-medium text-white"
              >
                Apply
              </button>
            </div>

            {couponError && (
              <p className="mt-2 text-sm text-red-600">
                {couponError}
              </p>
            )}
          </label>

          {totals && (
            <div className="mt-6 space-y-3 border-t border-[#eadfd5] pt-5 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>

                <span>
                  ₹{totals.subtotalInr.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Shipping</span>

                <span>
                  {totals.shippingInr
                    ? "₹" +
                      totals.shippingInr.toLocaleString("en-IN")
                    : "Free"}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Discount</span>

                <span>
                  - ₹{totals.discountInr.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between">
                <span>GST/Tax</span>

                <span>
                  ₹{totals.taxInr.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between border-t border-[#eadfd5] pt-4 font-medium">
                <span>Total</span>

                <span>
                  ₹{totals.totalInr.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
