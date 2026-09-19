"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "../../../components/AuthProvider";
import {
  apiClient,
  wishlistQuery,
  removeFromWishlistMutation,
} from "../../../lib/graphql";

type WishlistItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  priceInr: number;
  compareAtPriceInr?: number | null;
  imageUrl?: string | null;
  categorySlug?: string | null;
  sku: string;
};

export default function WishlistPage() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user) return;

    void apiClient()
      .request<{ myWishlist: WishlistItem[] }>(
        wishlistQuery,
      )
      .then((result) => {
        setItems(result.myWishlist);
      })
      .catch((e) => {
        setError(
          e instanceof Error
            ? e.message
            : "Unable to load your wishlist.",
        );
      });
  }, [loading, user]);

  async function remove(productId: string) {
    setBusyId(productId);
    setError("");

    try {
      const result = await apiClient().request<{
        removeFromWishlist: WishlistItem[];
      }>(removeFromWishlistMutation, {
        productId,
      });

      setItems(result.removeFromWishlist);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to remove this item.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        Loading wishlist…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="font-serif text-5xl text-[#5e473c]">
          Wishlist
        </h1>

        <p className="mt-4 text-[#8b7a70]">
          Sign in to save products to your wishlist.
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
    <main className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
        Saved for later
      </p>

      <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
        Wishlist
      </h1>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {!items.length ? (
        <div className="mt-10 rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-10 text-center">
          <p className="font-serif text-3xl text-[#5e473c]">
            Nothing saved yet.
          </p>

          <p className="mt-3 text-sm text-[#8b7a70]">
            Save little things you love and come back to them
            later.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <article key={item.id}>
              <Link
                href={`/products/${item.slug}`}
                className="block"
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[#f1e5d7]">
                  <Image
                    src={
                      item.imageUrl ??
                      `https://placehold.co/900x1100/F3E7D7/5E473C?text=${encodeURIComponent(
                        item.name,
                      )}`
                    }
                    alt={item.name}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
              </Link>

              <div className="px-1 pt-3">
                <Link href={`/products/${item.slug}`}>
                  <h2 className="text-[15px] font-medium text-[#332c28]">
                    {item.name}
                  </h2>

                  <p className="mt-1 text-sm text-[#8b7a70]">
                    ₹{item.priceInr.toLocaleString("en-IN")}
                  </p>
                </Link>

                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void remove(item.id)}
                  className="mt-3 text-xs text-[#8b7a70] underline underline-offset-4 hover:text-[#5e473c] disabled:opacity-50"
                >
                  {busyId === item.id
                    ? "Removing…"
                    : "Remove"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
