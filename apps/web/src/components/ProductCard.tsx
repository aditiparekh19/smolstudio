"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProductCard as ProductCardType } from "../lib/types";
import {
  apiClient,
  addToWishlistMutation,
  isWishlistedQuery,
  removeFromWishlistMutation,
} from "../lib/graphql";
import { useAuth } from "./AuthProvider";

export function ProductCard({
  product,
}: {
  product: ProductCardType;
}) {
  const { user } = useAuth();

  const [wishlisted, setWishlisted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setWishlisted(false);
      return;
    }

    let cancelled = false;

    void apiClient()
      .request<{ isWishlisted: boolean }>(
        isWishlistedQuery,
        {
          productId: product.id,
        },
      )
      .then((result) => {
        if (!cancelled) {
          setWishlisted(result.isWishlisted);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWishlisted(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, product.id]);

  async function toggleWishlist(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (busy) return;

    setBusy(true);

    try {
      if (wishlisted) {
        await apiClient().request(
          removeFromWishlistMutation,
          {
            productId: product.id,
          },
        );

        setWishlisted(false);
      } else {
        await apiClient().request(
          addToWishlistMutation,
          {
            productId: product.id,
          },
        );

        setWishlisted(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group">
      <div className="relative">
        <Link
          href={`/products/${product.slug}`}
          className="block"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[#f1e5d7]">
            <Image
              src={
                product.imageUrl ??
                `https://placehold.co/900x1100/F3E7D7/5E473C?text=${encodeURIComponent(
                  product.name,
                )}`
              }
              alt={product.name}
              fill
              unoptimized
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition duration-500 group-hover:scale-[1.025]"
            />

            {product.compareAtPriceInr && (
              <span className="absolute left-3 top-3 rounded-full bg-[#fffaf3]/90 px-3 py-1 text-[11px] font-medium text-[#6a5146]">
                New
              </span>
            )}
          </div>
        </Link>

        <button
          type="button"
          aria-label={
            wishlisted
              ? "Remove from wishlist"
              : "Add to wishlist"
          }
          aria-pressed={wishlisted}
          disabled={busy}
          onClick={toggleWishlist}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fffaf3]/95 text-lg text-[#5e473c] shadow-sm transition hover:scale-105 disabled:opacity-60"
        >
          {wishlisted ? "♥" : "♡"}
        </button>
      </div>

      <Link
        href={`/products/${product.slug}`}
        className="block px-1 pt-3"
      >
        <h3 className="text-[15px] font-medium text-[#332c28]">
          {product.name}
        </h3>

        <p className="mt-1 text-sm text-[#8b7a70]">
          ₹{product.priceInr.toLocaleString("en-IN")}
        </p>
      </Link>
    </article>
  );
}
