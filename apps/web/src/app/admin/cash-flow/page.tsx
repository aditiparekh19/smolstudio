"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import { adminCashFlowHistoryQuery } from "../../../lib/orders";

type CashFlowHistoryRow = {
  date: string;
  incomeInr: number;
  refundInr: number;
  storeCreditInr: number;
  netCashFlowInr: number;
};

type MonthlyCashFlow = {
  month: string;
  incomeInr: number;
  refundInr: number;
  storeCreditInr: number;
  netCashFlowInr: number;
};

export default function AdminCashFlowPage() {
  const [rows, setRows] = useState<CashFlowHistoryRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const monthlyCashFlow = rows.reduce<MonthlyCashFlow[]>((result, row) => {
    const monthKey = row.date.slice(0, 7);

    if (!monthKey) {
      return result;
    }

    const existing = result.find((item) => item.month === monthKey);

    if (existing) {
      existing.incomeInr += Number(row.incomeInr || 0);
      existing.refundInr += Number(row.refundInr || 0);
      existing.storeCreditInr += Number(row.storeCreditInr || 0);
      existing.netCashFlowInr += Number(row.netCashFlowInr || 0);
    } else {
      result.push({
        month: monthKey,
        incomeInr: Number(row.incomeInr || 0),
        refundInr: Number(row.refundInr || 0),
        storeCreditInr: Number(row.storeCreditInr || 0),
        netCashFlowInr: Number(row.netCashFlowInr || 0),
      });
    }

    return result.sort((a, b) => a.month.localeCompare(b.month));
  }, []);

  useEffect(() => {
    void apiClient()
      .request<{
        adminCashFlowHistory: CashFlowHistoryRow[];
      }>(adminCashFlowHistoryQuery)
      .then((r) => {
        setRows(r.adminCashFlowHistory);
        setError("");
      })
      .catch((e) => {
        setError(
          e instanceof Error ? e.message : "Unable to load cash-flow history.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const totalIncome = rows.reduce(
    (sum, row) => sum + Number(row.incomeInr || 0),
    0,
  );

  const totalRefunds = rows.reduce(
    (sum, row) => sum + Number(row.refundInr || 0),
    0,
  );

  const totalStoreCredit = rows.reduce(
    (sum, row) => sum + Number(row.storeCreditInr || 0),
    0,
  );

  const netCashFlow = totalIncome - totalRefunds - totalStoreCredit;

  return (
    <main className="min-h-screen bg-[#fcf8f3] px-5 py-10 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-[#eadfd5] pb-8">
          <Link href="/admin" className="text-sm text-[#8b7a70]">
            ← Back office
          </Link>

          <p className="mt-8 text-xs uppercase tracking-[0.2em] text-[#9a877c]">
            Finance
          </p>

          <h1 className="mt-2 font-serif text-5xl tracking-[-0.04em] text-[#5e473c] sm:text-6xl">
            Cash Flow
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8b7a70]">
            Track customer payments, actual refunds, store credit issued and
            your net cash flow.
          </p>
        </header>

        {error && (
          <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="mt-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CashFlowMetric
              label="Captured payments"
              value={totalIncome}
              detail="Successful Razorpay payments"
            />

            <CashFlowMetric
              label="Actual refunds"
              value={totalRefunds}
              detail="Money refunded to customers"
            />

            <CashFlowMetric
              label="Store credit"
              value={totalStoreCredit}
              detail="Credit issued for product faults"
            />

            <CashFlowMetric
              label="Net cash flow"
              value={netCashFlow}
              detail="Income minus refunds and credit"
            />
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
              Trend
            </p>

            <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#5e473c]">
              Monthly cash flow
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#8b7a70]">
              Income, refunds, store credit and net cash flow over time.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[#eadfd5] bg-[#fffaf4] p-6">
            {monthlyCashFlow.length === 0 ? (
              <p className="text-sm text-[#9a877c]">
                No cash-flow activity yet.
              </p>
            ) : (
              <div className="space-y-4">
                {monthlyCashFlow.map((row) => (
                  <div
                    key={row.month}
                    className="grid grid-cols-[100px_1fr] items-center gap-4"
                  >
                    <span className="text-sm font-medium text-[#5e473c]">
                      {formatMonth(row.month)}
                    </span>

                    <div className="h-3 overflow-hidden rounded-full bg-[#f0e4d8]">
                      <div
                        className="h-full rounded-full bg-[#8b6f61]"
                        style={{
                          width: `${
                            totalIncome > 0
                              ? Math.min(
                                  100,
                                  (row.incomeInr / totalIncome) * 100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
              Monthly summary
            </p>

            <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#5e473c]">
              Cash flow by month
            </h2>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-[#eadfd5] bg-[#fffaf4]">
            {monthlyCashFlow.length === 0 ? (
              <div className="p-8 text-sm text-[#9a877c]">
                No monthly cash-flow activity yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-[#eadfd5] text-xs uppercase tracking-[0.12em] text-[#9a877c]">
                      <th className="px-6 py-4 font-medium">Month</th>
                      <th className="px-6 py-4 text-right font-medium">
                        Captured payments
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        Refunds
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        Store credit
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        Net cash flow
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {monthlyCashFlow.map((row) => (
                      <tr
                        key={row.month}
                        className="border-b border-[#f0e5dc] last:border-b-0"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-[#5e473c]">
                          {formatMonth(row.month)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-[#5e473c]">
                          {formatInr(row.incomeInr)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-[#8b5f52]">
                          {formatInr(row.refundInr)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-[#8b5f52]">
                          {formatInr(row.storeCreditInr)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm font-semibold text-[#5e473c]">
                          {formatInr(row.netCashFlowInr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a877c]">
              History
            </p>

            <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#5e473c]">
              Revenue history
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#8b7a70]">
              Daily income, refunds, store credit and net cash flow.
            </p>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-[#eadfd5] bg-[#fffaf4]">
            {loading ? (
              <div className="p-8 text-sm text-[#9a877c]">
                Loading cash-flow history…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-sm text-[#9a877c]">
                No cash-flow activity yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-[#eadfd5] text-xs uppercase tracking-[0.12em] text-[#9a877c]">
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 text-right font-medium">
                        Income
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        Refunds
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        Store credit
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        Net cash flow
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={`${row.date}-${index}`}
                        className="border-b border-[#f0e5dc] last:border-b-0"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-[#5e473c]">
                          {formatCashFlowDate(row.date)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-[#5e473c]">
                          {formatInr(row.incomeInr)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-[#8b5f52]">
                          {formatInr(row.refundInr)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm text-[#8b5f52]">
                          {formatInr(row.storeCreditInr)}
                        </td>

                        <td className="px-6 py-4 text-right text-sm font-semibold text-[#5e473c]">
                          {formatInr(row.netCashFlowInr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function CashFlowMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-[#eadfd5] bg-[#fffaf4] p-6">
      <p className="text-sm font-medium text-[#8b7a70]">{label}</p>

      <p className="mt-4 font-serif text-3xl tracking-[-0.04em] text-[#5e473c]">
        {formatInr(value)}
      </p>

      <p className="mt-2 text-sm text-[#9a877c]">{detail}</p>
    </div>
  );
}

function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCashFlowDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return "—";
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return "—";
  }

  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
