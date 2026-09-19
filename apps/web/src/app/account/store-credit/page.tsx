"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { apiClient } from "../../../lib/graphql";
import { myStoreCreditQuery } from "../../../lib/orders";

type StoreCreditTransaction = {
  id: string;
  type: string;
  amountInr: number;
  balanceAfterInr: number;
  orderId: string | null;
  description: string | null;
  createdAt: string;
};

type StoreCredit = {
  balanceInr: number;
  reservedInr: number;
  availableInr: number;
  transactions: StoreCreditTransaction[];
};

export default function StoreCreditPage() {
  const { user, loading: authLoading } = useAuth();

  const [credit, setCredit] = useState<StoreCredit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadStoreCredit() {
      setLoading(true);
      setError("");

      try {
        const response = await apiClient().request<{
          myStoreCredit: StoreCredit;
        }>(myStoreCreditQuery);

        setCredit(response.myStoreCredit);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not load your store credit.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadStoreCredit();
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">Loading account…</main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
          Account
        </p>

        <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
          Store credit
        </h1>

        <p className="mt-4 text-[#8b7a70]">
          Sign in to view your store credit.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
        Account
      </p>

      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Store credit</h1>

      <p className="mt-4 max-w-xl text-[#8b7a70]">
        Store credit can be used toward your future SmolStudio orders.
      </p>

      {loading && (
        <div className="mt-10 rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-7">
          <p className="text-sm text-[#8b7a70]">Loading your store credit…</p>
        </div>
      )}

      {error && (
        <div className="mt-10 rounded-[2rem] border border-red-200 bg-red-50 p-7">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {credit && !loading && !error && (
        <div className="mt-10 space-y-5">
          <section className="rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8b7a70]">
              Available balance
            </p>

            <p className="mt-3 font-serif text-5xl text-[#5e473c]">
              ₹
              {credit.availableInr.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>

            <p className="mt-3 text-sm leading-6 text-[#8b7a70]">
              This is the amount currently available to use on a new order.
            </p>
          </section>

          {credit.reservedInr > 0 && (
            <section className="rounded-[2rem] border border-[#eadfd5] bg-white p-7">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8b7a70]">
                Temporarily reserved
              </p>

              <p className="mt-2 text-2xl text-[#5e473c]">
                ₹
                {credit.reservedInr.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>

              <p className="mt-2 text-sm leading-6 text-[#8b7a70]">
                This amount is temporarily reserved for a pending payment and is
                not currently available to use.
              </p>
            </section>
          )}

          <section className="rounded-[2rem] border border-[#eadfd5] bg-white p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-[#8b7a70]">
              Account balance
            </p>

            <div className="mt-4 flex items-center justify-between gap-5">
              <span className="text-sm text-[#8b7a70]">Total store credit</span>

              <span className="text-sm font-medium text-[#332c28]">
                ₹
                {credit.balanceInr.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {credit.reservedInr > 0 && (
              <div className="mt-3 flex items-center justify-between gap-5">
                <span className="text-sm text-[#8b7a70]">
                  Reserved for pending payment
                </span>

                <span className="text-sm text-[#332c28]">
                  − ₹
                  {credit.reservedInr.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}

            <div className="mt-5 border-t border-[#eadfd5] pt-5">
              <div className="flex items-center justify-between gap-5">
                <span className="text-sm font-medium text-[#5e473c]">
                  Available to use
                </span>

                <span className="text-lg font-medium text-[#5e473c]">
                  ₹
                  {credit.availableInr.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#eadfd5] bg-white p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8b7a70]">
                  Activity
                </p>

                <h2 className="mt-2 font-serif text-2xl text-[#5e473c]">
                  Transaction history
                </h2>
              </div>
            </div>

            {credit.transactions.length === 0 ? (
              <p className="mt-6 text-sm leading-6 text-[#8b7a70]">
                No store credit transactions yet.
              </p>
            ) : (
              <div className="mt-6 divide-y divide-[#eadfd5]">
                {credit.transactions.map((transaction) => {
                  const isCredit = transaction.amountInr > 0;

                  return (
                    <div
                      key={transaction.id}
                      className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#332c28]">
                          {transaction.description
                            ? transaction.description
                            : transaction.type
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (char) => char.toUpperCase())}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#8b7a70]">
                          <span>
                            {new Date(transaction.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>

                          {transaction.orderId && (
                            <span>Order #{transaction.orderId}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p
                          className={`text-sm font-medium ${
                            isCredit ? "text-green-700" : "text-[#5e473c]"
                          }`}
                        >
                          {isCredit ? "+" : "−"} ₹
                          {Math.abs(transaction.amountInr).toLocaleString(
                            "en-IN",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </p>

                        <p className="mt-1 text-xs text-[#8b7a70]">
                          Balance ₹
                          {transaction.balanceAfterInr.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/account"
              className="rounded-full border border-[#cdbfb5] px-5 py-3 text-sm text-[#5e473c]"
            >
              Back to account
            </Link>

            <Link
              href="/cart"
              className="rounded-full bg-[#5e473c] px-5 py-3 text-sm text-white"
            >
              View bag
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
