import Image from "next/image";
import { notFound } from "next/navigation";
import { graphqlClient, productQuery } from "../../../lib/graphql";
import type { Product } from "../../../lib/types";
import { AddToBag } from "../../../components/AddToBag";
import ProductGallery from "../../../components/ProductGallery";
import ProductReviews from "../../../components/ProductReviews";

export const revalidate = 60;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product } = await graphqlClient.request<{ product: Product | null }>(
    productQuery,
    { slug },
  );

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery product={product} />

        <div className="flex flex-col justify-center lg:px-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
            {product.categorySlug}
          </p>
          <h1 className="mt-3 font-serif text-5xl tracking-[-0.04em] text-[#5e473c]">
            {product.name}
          </h1>
          <div className="mt-5 flex items-center gap-3">
            <span className="text-lg text-[#332c28]">
              ₹{product.priceInr.toLocaleString("en-IN")}
            </span>
            {product.compareAtPriceInr && (
              <span className="text-sm text-[#a18e83] line-through">
                ₹{product.compareAtPriceInr.toLocaleString("en-IN")}
              </span>
            )}
          </div>
          <p className="mt-6 max-w-lg text-sm leading-7 text-[#75645b]">
            {product.description}
          </p>

          <div className="mt-8 max-w-sm">
            <AddToBag
              variants={product.variants}
              disabled={product.stock < 1}
            />
            <p className="mt-3 text-center text-xs text-[#8b7a70]">
              {product.stock > 0
                ? `${product.stock} pieces currently available`
                : "Currently sold out"}
            </p>
          </div>
        </div>
      </div>
      <ProductReviews productId={product.id} />
    </main>
  );
}
