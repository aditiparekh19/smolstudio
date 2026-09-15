import Image from "next/image";
import Link from "next/link";
import type { ProductCard as ProductCardType } from "../lib/types";

export function ProductCard({ product }: { product: ProductCardType }) {
  return (
    <article className="group">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[#f1e5d7]">
          <Image
            src={
              (product.imageUrl ??
                  `https://placehold.co/900x1100/F3E7D7/5E473C?text=${encodeURIComponent(product.name)}`)
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

        <div className="px-1 pt-3">
          <h3 className="text-[15px] font-medium text-[#332c28]">
            {product.name}
          </h3>
          <p className="mt-1 text-sm text-[#8b7a70]">
            ₹{product.priceInr.toLocaleString("en-IN")}
          </p>
        </div>
      </Link>
    </article>
  );
}
