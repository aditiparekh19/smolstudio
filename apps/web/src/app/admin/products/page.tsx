"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import {
  adminDeleteProductMutation,
  adminProductsQuery,
} from "../../../lib/admin";
import { useAuth } from "../../../components/AuthProvider";

type Row = {
  id: string;
  name: string;
  sku: string;
  slug: string;
  priceInr: number;
  imageUrl: string | null;
  isActive: boolean;
  stock: number;
  categoryName: string;
};
export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    try {
      const r = await apiClient().request<{ adminProducts: Row[] }>(
        adminProductsQuery,
        {
          search: search || undefined,
          active: filter === "all" ? undefined : filter === "active",
        },
      );
      setRows(r.adminProducts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load products.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user, filter]);
  if (loading)
    return <main className="mx-auto max-w-7xl px-5 py-16">Loading…</main>;
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF"))
    return (
      <main className="mx-auto max-w-7xl px-5 py-16">
        Admin access required.
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-[#8b7a70]">
            ← Back office
          </Link>
          <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Products</h1>
          <p className="mt-2 text-[#8b7a70]">
            Manage catalog details, variants, inventory and every product image.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-[#5e473c] px-5 py-3 text-sm font-medium text-white"
        >
          Add product
        </Link>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
          placeholder="Search name, SKU or slug"
          className="min-w-[280px] flex-1 rounded-full border border-[#d9cbc0] bg-white px-5 py-3"
        />
        <button
          onClick={load}
          className="rounded-full border border-[#cdbfb5] px-5 py-3 text-sm"
        >
          Search
        </button>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="rounded-full border border-[#d9cbc0] bg-white px-5 py-3"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 overflow-hidden rounded-[2rem] border border-[#eadfd5] bg-white">
        {busy ? (
          <p className="p-8 text-[#8b7a70]">Loading products…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-[#8b7a70]">No products found.</p>
        ) : (
          <div className="divide-y divide-[#eadfd5]">
            {rows.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-4 p-4 sm:p-5"
              >
                <div className="h-20 w-16 overflow-hidden rounded-xl bg-[#f3e7d7]">
                  {p.imageUrl && (
                    <img
                      src={
                        p.imageUrl.startsWith("/media/")
                          ? `${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000"}${p.imageUrl}`
                          : p.imageUrl
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-[220px] flex-1">
                  <p className="font-medium text-[#5e473c]">{p.name}</p>
                  <p className="mt-1 text-xs text-[#8b7a70]">
                    {p.sku} · {p.categoryName}
                  </p>
                </div>
                <div className="text-sm">
                  ₹{p.priceInr.toLocaleString("en-IN")}
                  <p className="text-xs text-[#8b7a70]">{p.stock} in stock</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${p.isActive ? "bg-[#e7f1e5] text-[#46613e]" : "bg-[#eee8e3] text-[#776a62]"}`}
                >
                  {p.isActive ? "Active" : "Draft"}
                </span>
                <Link
                  href={`/admin/products/${p.id}`}
                  className="rounded-full border border-[#cdbfb5] px-4 py-2 text-sm"
                >
                  Edit
                </Link>
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete ${p.name}? This removes its variants, cart references and images.`,
                      )
                    )
                      return;
                    try {
                      await apiClient().request(adminDeleteProductMutation, {
                        id: p.id,
                      });
                      setRows((x) => x.filter((r) => r.id !== p.id));
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Delete failed.",
                      );
                    }
                  }}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
