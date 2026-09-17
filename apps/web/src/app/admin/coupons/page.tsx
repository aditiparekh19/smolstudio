"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import {
  adminCouponsQuery,
  deleteCouponMutation,
  saveCouponMutation,
} from "../../../lib/orders";
import { useAuth } from "../../../components/AuthProvider";
export default function Coupons() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENT");
  const [value, setValue] = useState("10");
  const [min, setMin] = useState("0");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try {
      setRows((await apiClient().request<any>(adminCouponsQuery)).adminCoupons);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load coupons.");
    }
  }
  useEffect(() => {
    if (!loading && user) void load();
  }, [loading, user]);
  if (loading)
    return <main className="mx-auto max-w-6xl px-5 py-16">Loading…</main>;
  if (!user || !["ADMIN", "STAFF"].includes(user.role))
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        Admin access required.
      </main>
    );

  async function add() {
    try {
      await apiClient().request(saveCouponMutation, {
        code,
        discountType: type,
        discountValue: Number(value),
        minOrderInr: Number(min) || 0,
        maxDiscountInr: null,
        maxRedemptions: limit ? Number(limit) : null,
        startsAt: new Date().toISOString(),
        isActive: true,
      });

      setCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save coupon.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <Link href="/admin" className="text-sm text-[#8b7a70]">
        ← Back office
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Coupons</h1>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-8 grid gap-3 rounded-[2rem] border border-[#eadfd5] bg-white p-6 md:grid-cols-6">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Code"
          className="rounded-xl border border-[#d9cbc0] px-3 py-3"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-[#d9cbc0] px-3 py-3"
        >
          <option>PERCENT</option>
          <option>FIXED</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Discount"
          type="number"
          className="rounded-xl border border-[#d9cbc0] px-3 py-3"
        />
        <input
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="Min order"
          type="number"
          className="rounded-xl border border-[#d9cbc0] px-3 py-3"
        />
        <input
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="Usage limit"
          type="number"
          className="rounded-xl border border-[#d9cbc0] px-3 py-3"
        />
        <button
          onClick={() => void add()}
          className="rounded-full bg-[#5e473c] px-4 py-3 text-white"
        >
          Add
        </button>
      </div>
      <div className="mt-6 divide-y divide-[#eadfd5] rounded-[2rem] border border-[#eadfd5] bg-white">
        {rows.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="flex-1">
              <p className="font-medium">{c.code}</p>
              <p className="text-xs text-[#8b7a70]">
                {c.discountType === "PERCENT"
                  ? `${c.discountValue}%`
                  : `₹${c.discountValue}`}{" "}
                · min ₹{c.minOrderInr} · used {c.redeemedCount}
                {c.maxRedemptions ? `/${c.maxRedemptions}` : ""}
              </p>
            </div>
            <span>{c.isActive ? "Active" : "Inactive"}</span>
            <button
              onClick={async () => {
                await apiClient().request(deleteCouponMutation, { id: c.id });
                await load();
              }}
              className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
            >
              Disable
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
