"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { useAuth } from "../../components/AuthProvider";
import { useCart } from "../../components/CartProvider";
import { apiClient } from "../../lib/graphql";
import {
  checkoutTotalsQuery,
  createPaymentOrderMutation,
  verifyPaymentMutation,
  myAddressesQuery,
  eligibleProductFaultReturnQuantityQuery,
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

  const [
    eligibleProductFaultReturnQuantity,
    setEligibleProductFaultReturnQuantity,
  ] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");

  /*
   * ============================================================
   * CONFETTI TRACKING
   * ============================================================
   *
   * These refs prevent confetti from firing repeatedly when
   * React re-renders or checkout totals are recalculated.
   */
  const previousShippingRef = useRef<number | null>(null);
  const freeDeliveryCelebratedRef = useRef(false);
  const orderCelebratedRef = useRef(false);

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
   * CONFETTI HELPERS
   * ============================================================
   */

  function celebrateFreeDelivery() {
    void confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 30,
      origin: {
        x: 0.5,
        y: 0.65,
      },
      scalar: 0.9,
    });
  }

  function celebrateOrderSuccess() {
    const duration = 1600;
    const animationEnd = Date.now() + duration;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        window.clearInterval(interval);
        return;
      }

      const particleCount = Math.round(45 * (timeLeft / duration));

      void confetti({
        particleCount,
        spread: 70,
        startVelocity: 45,
        origin: {
          x: Math.random() * 0.25 + 0.05,
          y: 0.65,
        },
        scalar: 1,
      });

      void confetti({
        particleCount,
        spread: 70,
        startVelocity: 45,
        origin: {
          x: Math.random() * 0.25 + 0.7,
          y: 0.65,
        },
        scalar: 1,
      });
    }, 180);
  }

  /*
   * ============================================================
   * WATCH FOR FREE DELIVERY
   * ============================================================
   *
   * Confetti only fires when shipping changes from a paid amount
   * to ₹0. It does not fire simply because the checkout page
   * initially loads with free shipping.
   */
  useEffect(() => {
    if (!totals) return;

    const shipping = Number(totals.shippingInr ?? 0);

    const previousShipping = previousShippingRef.current;

    if (
      previousShipping !== null &&
      previousShipping > 0 &&
      shipping <= 0 &&
      !freeDeliveryCelebratedRef.current
    ) {
      freeDeliveryCelebratedRef.current = true;
      celebrateFreeDelivery();
    }

    previousShippingRef.current = shipping;
  }, [totals]);

  /*
   * ============================================================
   * LOAD ELIGIBLE RETURN QUANTITY
   * ============================================================
   */
  useEffect(() => {
    if (!user) return;

    void apiClient()
      .request<any>(eligibleProductFaultReturnQuantityQuery)
      .then((r) => {
        setEligibleProductFaultReturnQuantity(
          Number(r.eligibleProductFaultReturnQuantity?.eligibleQuantity ?? 0),
        );
      })
      .catch(() => {
        setEligibleProductFaultReturnQuantity(0);
      });
  }, [user]);

  /*
   * Existing dependency tracking.
   */
  useEffect(() => {}, [user, items.length, coupon, appliedCoupon, totals]);

  /*
   * ============================================================
   * LOAD RAZORPAY
   * ============================================================
   */
  useEffect(() => {
    if (!document.querySelector("script[data-razorpay]")) {
      const s = document.createElement("script");

      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;

      s.dataset.razorpay = "1";

      document.body.appendChild(s);
    }
  }, []);

  /*
   * ============================================================
   * LOAD SAVED ADDRESSES
   * ============================================================
   */
  useEffect(() => {
    if (!user) return;

    void apiClient()
      .request<any>(myAddressesQuery)
      .then((r) => {
        setAddresses(r.myAddresses || []);

        if (r.myAddresses?.[0]) {
          setAddress(r.myAddresses[0]);
        }
      })
      .catch(() => {});
  }, [user]);

  /*
   * ============================================================
   * CALCULATE CHECKOUT TOTALS
   * ============================================================
   */
  useEffect(() => {
    if (!user || !items.length) {
      return;
    }

    const t = setTimeout(() => {
      const variables = {
        couponCode: appliedCoupon || undefined,
      };

      void apiClient()
        .request<any>(checkoutTotalsQuery, variables)
        .then((r) => {
          setTotals(r.checkoutTotals);

          setCouponError("");
          setError("");

          if (
            appliedCoupon &&
            Number(r.checkoutTotals?.discountInr ?? 0) <= 0
          ) {
            setAppliedCoupon("");

            setCouponError(
              "This coupon could not be applied to your current order.",
            );
          }
        })
        .catch((err: any) => {
          const graphqlMessage =
            err?.response?.errors?.[0]?.message ||
            err?.response?.data?.errors?.[0]?.message ||
            err?.message ||
            "Unable to calculate checkout total.";

          const isCouponError =
            graphqlMessage.toLowerCase().includes("coupon") ||
            graphqlMessage.toLowerCase().includes("welcome5");

          if (isCouponError) {
            setCouponError(graphqlMessage);
            setError("");
          } else {
            setError(graphqlMessage);
            setCouponError("");
          }
        });
    }, 250);

    return () => clearTimeout(t);
  }, [appliedCoupon, user, items.length]);

  if (!items.length) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <Link href="/account" className="text-sm text-[#8b7a70]">
          ← Account
        </Link>
        <h1 className="font-serif text-5xl text-[#5e473c]">Checkout</h1>

        <p className="mt-4 text-[#8b7a70]">Your bag is empty.</p>

        <Link href="/" className="mt-6 inline-block underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-serif text-5xl text-[#5e473c]">Checkout</h1>

        <p className="mt-4 text-[#8b7a70]">Please sign in before checkout.</p>

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

  async function submit(e: FormEvent) {
    e.preventDefault();

    const phoneValidationError = validatePhone(address.phone || "");

    if (phoneValidationError) {
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
        couponCode: appliedCoupon || null,
      };

      const r = await apiClient().request<any>(
        createPaymentOrderMutation,
        paymentVariables,
      );

      const paymentOrder = r.createPaymentOrder;

      if (!paymentOrder?.orderId) {
        throw new Error("The server did not return a valid order ID.");
      }

      /*
       * ========================================================
       * FULL STORE CREDIT CHECKOUT
       * ========================================================
       */
      if (
        Number(paymentOrder.amount) <= 0 ||
        Number(paymentOrder.payableInr) <= 0
      ) {
        setMessage("Your order has been placed using store credit.");

        if (!orderCelebratedRef.current) {
          orderCelebratedRef.current = true;
          celebrateOrderSuccess();
        }

        await refreshCart();

        router.push(`/account/orders/${paymentOrder.orderId}`);

        return;
      }

      /*
       * ========================================================
       * NORMAL RAZORPAY CHECKOUT
       * ========================================================
       */

      if (!window.Razorpay) {
        throw new Error(
          "Payment checkout is still loading. Please wait a moment and try again.",
        );
      }

      if (!paymentOrder.razorpayOrderId) {
        throw new Error("Razorpay order was not created. Please try again.");
      }

      const options = {
        key: paymentOrder.keyId,

        amount: paymentOrder.amount,

        currency: paymentOrder.currency,

        name: "SmolStudio",

        description: `Order ${paymentOrder.orderNumber}`,

        order_id: paymentOrder.razorpayOrderId,

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

            const orderId = paymentOrder.orderId;

            await apiClient().request<any>(verifyPaymentMutation, {
              orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (!orderId) {
              throw new Error(
                "Payment succeeded, but the server did not return a valid order ID.",
              );
            }

            /*
             * Payment has been successfully verified.
             * Celebrate before redirecting to the order page.
             */
            if (!orderCelebratedRef.current) {
              orderCelebratedRef.current = true;
              celebrateOrderSuccess();
            }

            await refreshCart();

            router.push(`/account/orders/${orderId}`);
          } catch (err: any) {
            const graphqlMessage =
              err?.response?.errors?.[0]?.message ||
              err?.message ||
              "Payment verification failed. Please contact support.";

            setError(graphqlMessage);
            setBusy(false);
          }
        },

        modal: {
          ondismiss: () => {
            setBusy(false);
          },
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", (response: any) => {
        setError(
          response?.error?.description || "Payment failed. You can try again.",
        );

        setBusy(false);
      });

      checkout.open();
    } catch (err: any) {
      const graphqlMessage =
        err?.response?.errors?.[0]?.message ||
        err?.message ||
        "Unable to place order.";

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

  const storeCreditApplied = Number(totals?.storeCreditAppliedInr || 0);

  const payable = Number(totals?.payableInr ?? totals?.totalInr ?? 0);

  const fullyCovered = totals && payable <= 0;

  const showReturnPolicyNotice = eligibleProductFaultReturnQuantity >= 2;

  return (
    <main className="mx-auto max-w-6xl px-5 py-14 lg:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
        Checkout
      </p>

      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Almost there.</h1>

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
          className="rounded-4xl border border-[#eadfd5] bg-white p-7"
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
                  const a = addresses.find((x) => x.id === e.target.value);

                  if (a) {
                    setAddress(a);
                  }
                }}
                defaultValue={addresses[0]?.id}
              >
                <option value="">New address</option>

                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || a.recipientName} - {a.city}
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
                  inputMode={key === "phone" ? "numeric" : undefined}
                  maxLength={key === "phone" ? 10 : undefined}
                  value={(address as any)[key] || ""}
                  onChange={(e) => {
                    let value = e.target.value;

                    if (key === "phone") {
                      value = value.replace(/\D/g, "").slice(0, 10);

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
                  <p className="mt-1 text-sm text-red-600">{phoneError}</p>
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

          {/* =====================================================
              RETURN POLICY NOTICE
              ===================================================== */}

          {showReturnPolicyNotice && (
            <div className="mt-6 rounded-2xl border border-[#e8d8c8] bg-[#fffaf4] px-5 py-4">
              <p className="text-sm font-semibold text-[#5e473c]">
                Return policy notice
              </p>

              <p className="mt-2 text-sm leading-6 text-[#6d5a50]">
                Your first 2 eligible product-fault return items are free. From
                the 3rd eligible item onward, a ₹100 return fee per item will
                apply and be deducted from your approved store credit.
              </p>

              <p className="mt-2 text-xs leading-5 text-[#8b7a70]">
                Size replacements do not carry a return fee. Rejected or
                cancelled return requests do not count toward the eligible
                return allowance.
              </p>
            </div>
          )}

          <button
            disabled={busy}
            className="mt-6 w-full rounded-full bg-[#5e473c] px-6 py-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? "Processing…"
              : fullyCovered
                ? "Place order with store credit"
                : "Pay securely with Razorpay"}
          </button>

          <p className="mt-3 text-xs leading-5 text-[#8b7a70]">
            {fullyCovered
              ? "Your available store credit covers the full order. No payment is required."
              : "Inventory is reserved for a short payment window and released automatically if payment fails or expires."}
          </p>
        </form>

        <aside className="h-fit rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
            Order summary
          </p>

          {items.map((i) => (
            <div key={i.id} className="mt-4 flex justify-between gap-4 text-sm">
              <span>
                {i.name} × {i.quantity}
              </span>

              <span>₹{i.totalInr.toLocaleString("en-IN")}</span>
            </div>
          ))}

          <label className="mt-6 block text-sm">
            Coupon code
            <div className="mt-2 flex gap-2">
              <input
                value={coupon}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();

                  setCoupon(value);
                  setCouponError("");
                }}
                placeholder=""
                className="min-w-0 flex-1 rounded-xl border border-[#d9cbc0] px-3 py-3"
              />

              <button
                type="button"
                onClick={() => {
                  const normalizedCoupon = coupon.trim().toUpperCase();

                  if (!normalizedCoupon) {
                    setCouponError("Please enter a coupon code.");
                    setAppliedCoupon("");
                    return;
                  }

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
              <p className="mt-2 text-sm text-red-600">{couponError}</p>
            )}
            {appliedCoupon &&
              !couponError &&
              Number(totals?.discountInr ?? 0) > 0 && (
                <p className="mt-2 text-xs text-[#6d5a50]">
                  Applied: <span className="font-medium">{appliedCoupon}</span>
                </p>
              )}
          </label>

          {totals && (
            <div className="mt-6 space-y-3 border-t border-[#eadfd5] pt-5 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>

                <span>
                  ₹{Number(totals.subtotalInr).toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Shipping</span>

                <span>
                  {Number(totals.shippingInr)
                    ? "₹" + Number(totals.shippingInr).toLocaleString("en-IN")
                    : "Free"}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Discount</span>

                <span>
                  - ₹{Number(totals.discountInr).toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between">
                <span>GST/Tax</span>

                <span>₹{Number(totals.taxInr).toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between border-t border-[#eadfd5] pt-4 font-medium">
                <span>Order total</span>

                <span>₹{Number(totals.totalInr).toLocaleString("en-IN")}</span>
              </div>

              {storeCreditApplied > 0 && (
                <div className="flex justify-between rounded-xl bg-white px-3 py-3 text-[#5e473c]">
                  <span>Store credit</span>

                  <span className="font-medium">
                    - ₹{storeCreditApplied.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t border-[#eadfd5] pt-4 text-base font-semibold text-[#5e473c]">
                <span>Amount to pay</span>

                <span>₹{payable.toLocaleString("en-IN")}</span>
              </div>

              {fullyCovered && (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                  Your store credit covers the entire order. You will not be
                  charged through Razorpay.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
