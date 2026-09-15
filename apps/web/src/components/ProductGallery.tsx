"use client";
import { useState } from "react";
import type { Product } from "../lib/types";

export default function ProductGallery({ product }: { product: Product }) {
  const fallback = `https://placehold.co/900x1100/F3E7D7/5E473C?text=${encodeURIComponent(product.name)}`;
  const images = product.images?.length
    ? product.images
    : [
        {
          id: "fallback",
          url: product.imageUrl ?? fallback,
          altText: product.name,
          sortOrder: 0,
          isPrimary: true,
        },
      ];
  const [selected, setSelected] = useState(0);
  const image = images[selected] ?? images[0];
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[#f1e5d7]">
        <img
          src={image.url}
          alt={image.altText ?? product.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setSelected(i)}
              className={`relative aspect-[4/5] overflow-hidden rounded-xl border-2 ${i === selected ? "border-[#5e473c]" : "border-transparent"}`}
            >
              <img
                src={item.url}
                alt={item.altText ?? product.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
