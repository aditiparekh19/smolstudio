"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/graphql";
import {
  adminCategoriesQuery,
  deleteCategoryMutation,
  saveCategoryMutation,
} from "../../../lib/orders";
import { useAuth } from "../../../components/AuthProvider";
export default function Categories() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try {
      setRows(
        (await apiClient().request<any>(adminCategoriesQuery)).adminCategories,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load categories.");
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
    setError("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter a category name.");
      return;
    }

    try {
      await apiClient().request(saveCategoryMutation, {
        name: trimmedName,
        slug: slug.trim() || undefined,
      });

      setName("");
      setSlug("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save category.");
    }
  }
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <Link href="/admin" className="text-sm text-[#8b7a70]">
        ← Back office
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Categories</h1>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-8 rounded-[2rem] border border-[#eadfd5] bg-white p-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="rounded-xl border border-[#d9cbc0] px-4 py-3"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Slug (optional)"
            className="rounded-xl border border-[#d9cbc0] px-4 py-3"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!name.trim()}
            className="rounded-full bg-[#5e473c] px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add category
          </button>
        </div>
      </div>
      <div className="mt-6 divide-y divide-[#eadfd5] rounded-4xl border border-[#eadfd5] bg-white">
        {rows.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="flex-1">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-[#8b7a70]">/{c.slug}</p>
            </div>
            <span>{c.isActive ? "Active" : "Inactive"}</span>
            <button
              onClick={async () => {
                if (confirm("Deactivate/delete this category?")) {
                  await apiClient().request(deleteCategoryMutation, {
                    id: c.id,
                  });
                  await load();
                }
              }}
              className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
