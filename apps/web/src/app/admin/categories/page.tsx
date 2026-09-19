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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      setError("");

      setRows(
        (await apiClient().request<any>(adminCategoriesQuery)).adminCategories,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load categories.",
      );
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
    const trimmedSlug = slug.trim();

    if (!trimmedName) {
      setError("Category name is required.");
      return;
    }

    try {
      await apiClient().request(saveCategoryMutation, {
        name: trimmedName,
        slug: trimmedSlug || null,
      });

      setName("");
      setSlug("");

      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to add category.",
      );
    }
  }

  function startEdit(category: any) {
    setError("");
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingSlug(category.slug);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
    setEditingSlug("");
  }

  async function saveEdit(category: any) {
    const trimmedName = editingName.trim();
    const trimmedSlug = editingSlug.trim();

    if (!trimmedName) {
      setError("Category name is required.");
      return;
    }

    setSavingId(category.id);
    setError("");

    try {
      await apiClient().request(saveCategoryMutation, {
        id: category.id,
        name: trimmedName,
        slug: trimmedSlug || null,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      });

      cancelEdit();
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update category.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
      <Link
        href="/admin"
        className="text-sm text-[#8b7a70] transition hover:text-[#5e473c]"
      >
        ← Back office
      </Link>

      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-serif text-5xl tracking-[-0.04em] text-[#5e473c]">
            Categories
          </h1>
          <p className="mt-2 text-sm text-[#8b7a70]">
            Organize products into customer-facing categories.
          </p>
        </div>
      </div>

      {/* Add category */}
      <div className="mt-8 rounded-4xl border border-[#eadfd5] bg-white p-6">
        <h2 className="font-serif text-2xl text-[#5e473c]">
          Add category
        </h2>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="flex-1 rounded-xl border border-[#d9cbc0] bg-[#fffdf9] px-4 py-3 outline-none transition focus:border-[#8b7a70]"
          />

          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Slug (optional)"
            className="flex-1 rounded-xl border border-[#d9cbc0] bg-[#fffdf9] px-4 py-3 outline-none transition focus:border-[#8b7a70]"
          />

          <button
            type="button"
            onClick={() => void add()}
            disabled={!name.trim()}
            className="rounded-full bg-[#5e473c] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#4d392f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add category
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Categories */}
      <div className="mt-6 divide-y divide-[#eadfd5] overflow-hidden rounded-4xl border border-[#eadfd5] bg-white">
        {rows.map((c) => {
          const isEditing = editingId === c.id;
          const isSaving = savingId === c.id;

          return (
            <div key={c.id} className="p-5">
              {isEditing ? (
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[#8b7a70]">
                      Name
                    </label>

                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full rounded-xl border border-[#d9cbc0] bg-[#fffdf9] px-4 py-3 outline-none transition focus:border-[#8b7a70]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[#8b7a70]">
                      Slug
                    </label>

                    <input
                      value={editingSlug}
                      onChange={(e) => setEditingSlug(e.target.value)}
                      className="w-full rounded-xl border border-[#d9cbc0] bg-[#fffdf9] px-4 py-3 outline-none transition focus:border-[#8b7a70]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(c)}
                      disabled={isSaving || !editingName.trim()}
                      className="rounded-full bg-[#5e473c] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#4d392f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>

                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="rounded-full border border-[#d9cbc0] px-5 py-3 text-sm text-[#5e473c] transition hover:bg-[#fffaf4] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#252321]">{c.name}</p>

                    <p className="text-xs text-[#8b7a70]">/{c.slug}</p>
                  </div>

                  <span
                    className={
                      c.isActive
                        ? "rounded-full bg-[#f0e4d8] px-3 py-1.5 text-xs font-medium text-[#5e473c]"
                        : "rounded-full bg-[#f3f0ed] px-3 py-1.5 text-xs font-medium text-[#8b7a70]"
                    }
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </span>

                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="rounded-full border border-[#d9cbc0] px-4 py-2 text-sm text-[#5e473c] transition hover:bg-[#fffaf4]"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm("Deactivate/delete this category?")) {
                        try {
                          setError("");

                          await apiClient().request(deleteCategoryMutation, {
                            id: c.id,
                          });

                          await load();
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Unable to remove category.",
                          );
                        }
                      }
                    }}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 transition hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="p-6 text-sm text-[#8b7a70]">
            No categories yet.
          </p>
        )}
      </div>
    </main>
  );
}
