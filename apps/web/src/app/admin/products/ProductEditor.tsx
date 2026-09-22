"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../lib/graphql";
import {
  adminDeleteImageMutation,
  adminDeleteVariantMutation,
  adminPrimaryImageMutation,
  adminProductQuery,
  adminReorderImagesMutation,
  adminSaveProductMutation,
  adminSaveVariantMutation,
  adminUploadImageMutation,
} from "../../../lib/admin";
import { categoriesQuery } from "../../../lib/graphql";
import { useAuth } from "../../../components/AuthProvider";
import { PRODUCT_SIZES } from "../../../lib/productSizes";

type Image = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};
type Variant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
};
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceInr: number;
  compareAtPriceInr: number | null;
  sku: string;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  images: Image[];
  variants: Variant[];
};
const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000";
const src = (url: string) => {
  const full = url.startsWith("/media/") ? origin + url : url;

  if (full.startsWith(origin + "/media/")) {
    return `${full}${full.includes("?") ? "&" : "?"}v=2`;
  }

  return full;
};
function blankVariant(productId: string) {
  return {
    id: undefined as string | undefined,
    productId,
    sku: "",
    size: "",
    color: "",
    stock: 0,
  };
}
export default function ProductEditor({ id }: { id?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<
    { id: string; slug: string; name: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newVariant, setNewVariant] = useState(() => blankVariant(id ?? ""));
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const c = await apiClient().request<{
          categories: { id: string; slug: string; name: string }[];
        }>(categoriesQuery);
        setCategories(c.categories);
        if (id) {
          const p = await apiClient().request<{ adminProduct: Product }>(
            adminProductQuery,
            { id },
          );
          setProduct(p.adminProduct);
          setNewVariant(blankVariant(id));
        } else
          setProduct({
            id: "",
            name: "",
            slug: "",
            description: "",
            priceInr: 0,
            compareAtPriceInr: null,
            sku: "",
            isActive: true,
            categoryId: c.categories[0]?.id ?? "",
            categoryName: "",
            images: [],
            variants: [],
          });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load editor.");
      }
    })();
  }, [loading, user, id]);
  if (loading)
    return <main className="mx-auto max-w-6xl px-5 py-16">Loading…</main>;
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF"))
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        Admin access required.
      </main>
    );
  if (!product)
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        {error ? (
          <>
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
            <button
              onClick={() => router.refresh()}
              className="mt-4 rounded-full border border-[#cdbfb5] px-5 py-3 text-sm"
            >
              Retry
            </button>
          </>
        ) : (
          "Loading product…"
        )}
      </main>
    );
  const p = product;
  async function uploadFiles(
    productId: string,
    files: File[],
    current: Product,
  ) {
    let latest = current;
    for (const file of files) {
      if (
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          file.type,
        )
      ) {
        throw new Error("Only JPG, PNG, WEBP and GIF images are allowed.");
      }
      if (file.size > 8 * 1024 * 1024)
        throw new Error(`${file.name} is larger than 8 MB.`);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await apiClient().request<{
        uploadProductImage: Product;
      }>(adminUploadImageMutation, {
        productId,
        filename: file.name,
        contentType: file.type,
        dataBase64: base64,
        altText: latest.name,
      });
      latest = response.uploadProductImage;
    }
    return latest;
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await apiClient().request<{ saveAdminProduct: Product }>(
        adminSaveProductMutation,
        {
          id: p.id || undefined,
          name: p.name,
          slug: p.slug,
          description: p.description || null,
          priceInr: Number(p.priceInr),
          compareAtPriceInr:
            p.compareAtPriceInr == null ? null : Number(p.compareAtPriceInr),
          sku: p.sku,
          categoryId: p.categoryId,
          isActive: p.isActive,
        },
      );
      let saved = r.saveAdminProduct;
      if (pendingImages.length) {
        saved = await uploadFiles(saved.id, pendingImages, saved);
        setPendingImages([]);
      }
      setProduct(saved);
      setMessage(
        pendingImages.length ? "Product and images saved." : "Product saved.",
      );
      if (!id) router.replace(`/admin/products/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function queueImages(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (!selected.length) return;
    setPendingImages((current) => [...current, ...selected]);
    setMessage(
      `${selected.length} image${selected.length === 1 ? "" : "s"} ready to save with the product.`,
    );
  }

  async function imageAction(action: "primary" | "delete", image: Image) {
    setBusy(true);
    try {
      const q =
        action === "primary"
          ? adminPrimaryImageMutation
          : adminDeleteImageMutation;
      const r = await apiClient().request<any>(q, { id: image.id });
      setProduct(
        action === "primary" ? r.setPrimaryProductImage : r.deleteProductImage,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image action failed.");
    } finally {
      setBusy(false);
    }
  }
  async function reorder(next: Image[]) {
    setProduct({ ...p, images: next });
    try {
      const r = await apiClient().request<{ reorderProductImages: Product }>(
        adminReorderImagesMutation,
        { productId: p.id, imageIds: next.map((x) => x.id) },
      );
      setProduct(r.reorderProductImages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed.");
    }
  }
  async function saveNewVariant() {
    if (!p.id) return;
    setBusy(true);
    try {
      const r = await apiClient().request<{ saveAdminVariant: Product }>(
        adminSaveVariantMutation,
        { ...newVariant, stock: Number(newVariant.stock) },
      );
      setProduct(r.saveAdminVariant);
      setNewVariant(blankVariant(p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variant save failed.");
    } finally {
      setBusy(false);
    }
  }
  async function removeVariant(v: Variant) {
    try {
      const r = await apiClient().request<{ deleteAdminVariant: Product }>(
        adminDeleteVariantMutation,
        { id: v.id },
      );
      setProduct(r.deleteAdminVariant);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variant delete failed.");
    }
  }
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm text-[#8b7a70]">
            ← Products
          </Link>
          <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
            {id ? "Edit product" : "New product"}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/admin/products")}
            className="rounded-full border border-[#cdbfb5] px-5 py-3 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={save}
            className="rounded-full bg-[#5e473c] px-6 py-3 text-sm font-medium text-white"
          >
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </div>
      {(error || message) && (
        <div className="mt-5">
          {error && (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
              {message}
            </p>
          )}
        </div>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <section className="space-y-6">
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
            <h2 className="font-serif text-2xl text-[#5e473c]">
              Product details
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm">
                Name
                <input
                  value={p.name}
                  onChange={(e) =>
                    setProduct({ ...product, name: e.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-4 py-3"
                />
              </label>
              <label className="text-sm">
                Slug
                <input
                  value={p.slug}
                  onChange={(e) =>
                    setProduct({ ...product, slug: e.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-4 py-3"
                />
              </label>
              <label className="text-sm">
                SKU
                <input
                  value={p.sku}
                  onChange={(e) =>
                    setProduct({ ...product, sku: e.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-4 py-3"
                />
              </label>
              <label className="sm:col-span-2 text-sm">
                Description
                <textarea
                  value={p.description ?? ""}
                  onChange={(e) =>
                    setProduct({ ...product, description: e.target.value })
                  }
                  rows={5}
                  className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-4 py-3"
                />
              </label>
              <label className="text-sm">
                Price (₹)
                <input
                  type="number"
                  min="0"
                  value={p.priceInr}
                  onChange={(e) =>
                    setProduct({ ...product, priceInr: Number(e.target.value) })
                  }
                  className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-4 py-3"
                />
              </label>
              <label className="text-sm">
                Compare-at price (₹)
                <input
                  type="number"
                  min="0"
                  value={p.compareAtPriceInr ?? ""}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      compareAtPriceInr:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-[#d9cbc0] px-4 py-3"
                />
              </label>
              <label className="text-sm">
                Category
                <select
                  value={p.categoryId}
                  onChange={(e) =>
                    setProduct({ ...product, categoryId: e.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-[#d9cbc0] bg-white px-4 py-3"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 self-end rounded-xl border border-[#eadfd5] p-3 text-sm">
                <input
                  type="checkbox"
                  checked={p.isActive}
                  onChange={(e) =>
                    setProduct({ ...product, isActive: e.target.checked })
                  }
                />{" "}
                Visible in storefront
              </label>
            </div>
          </div>
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl text-[#5e473c]">
                  Product images
                </h2>
                <p className="mt-1 text-sm text-[#8b7a70]">
                  Upload multiple images, set the primary image, remove images
                  and drag to reorder.
                </p>
              </div>
              <label className="cursor-pointer rounded-full bg-[#5e473c] px-5 py-3 text-sm text-white">
                Add images
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    queueImages(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {pendingImages.length > 0 && (
              <p className="mt-4 rounded-xl bg-[#fffaf4] p-4 text-sm text-[#75645b]">
                {pendingImages.length} new image
                {pendingImages.length === 1 ? "" : "s"} will be uploaded when
                you click <strong>Save product</strong>.
              </p>
            )}
            {p.id && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {p.images.map((image, index) => (
                  <div
                    key={image.id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("image-id", image.id)
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = p.images.findIndex(
                        (x) => x.id === e.dataTransfer.getData("image-id"),
                      );
                      if (from < 0 || from === index) return;
                      const next = [...p.images];
                      const [moved] = next.splice(from, 1);
                      next.splice(index, 0, moved);
                      reorder(next);
                    }}
                    className="overflow-hidden rounded-2xl border border-[#eadfd5] bg-[#fffaf4]"
                  >
                    <div className="aspect-[4/5] bg-[#f3e7d7]">
                      <img
                        src={src(image.url)}
                        alt={image.altText ?? p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#8b7a70]">
                          #{index + 1}
                        </span>
                        {image.isPrimary && (
                          <span className="rounded-full bg-[#e7f1e5] px-2 py-1 text-[10px] text-[#46613e]">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          disabled={image.isPrimary || busy}
                          onClick={() => imageAction("primary", image)}
                          className="flex-1 rounded-full border border-[#cdbfb5] px-2 py-1.5 text-xs"
                        >
                          Primary
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => imageAction("delete", image)}
                          className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-4xl border border-[#eadfd5] bg-white p-6">
            <h2 className="font-serif text-2xl text-[#5e473c]">
              Variants & inventory
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[20%]" />
                  <col className="w-[25%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>

                <thead>
                  <tr className="border-b border-[#eadfd5] text-left text-xs uppercase tracking-wider text-[#8b7a70]">
                    <th className="pb-3">SKU</th>
                    <th className="pb-3">Size</th>
                    <th className="pb-3">Color</th>
                    <th className="pb-3">Stock</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>

                <tbody>
                  {p.variants.map((v) => (
                    <tr key={v.id} className="border-b border-[#f0e8e2]">
                      <td className="py-3">{v.sku}</td>
                      <td className="py-3">{v.size}</td>
                      <td className="py-3">{v.color}</td>
                      <td className="py-3">{v.stock}</td>
                      <td className="py-3">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() =>
                              setNewVariant({
                                id: v.id,
                                productId: p.id,
                                sku: v.sku,
                                size: v.size,
                                color: v.color,
                                stock: v.stock,
                              })
                            }
                            className="text-[#5e473c]"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => removeVariant(v)}
                            className="text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {p.id && (
              <div className="mt-3 grid grid-cols-[25%_20%_25%_15%_15%] gap-0">
                {/* SKU */}
                <div className="pr-2">
                  <input
                    placeholder="Variant SKU"
                    value={newVariant.sku}
                    onChange={(e) =>
                      setNewVariant({
                        ...newVariant,
                        sku: e.target.value,
                      })
                    }
                    className="h-10 w-full rounded-xl border border-[#d9cbc0] px-3 text-sm"
                  />
                </div>

                {/* Size */}
                <select
                  value={newVariant.size}
                  onChange={(e) => {
                    setNewVariant({
                      ...newVariant,
                      size: e.target.value,
                    });
                  }}
                  className="w-full rounded-xl border border-[#d9cbc0] bg-[#fffdf9] px-4 py-3 outline-none transition focus:border-[#8b7a70]"
                >
                  <option value="">Select size</option>

                  {PRODUCT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>

                {/* Color */}
                <div className="px-1">
                  <input
                    placeholder="Color"
                    value={newVariant.color}
                    onChange={(e) =>
                      setNewVariant({
                        ...newVariant,
                        color: e.target.value,
                      })
                    }
                    className="h-10 w-full rounded-xl border border-[#d9cbc0] px-3 text-sm"
                  />
                </div>

                {/* Stock */}
                <div className="px-1">
                  <input
                    type="number"
                    min="0"
                    placeholder="Stock"
                    value={newVariant.stock}
                    onChange={(e) =>
                      setNewVariant({
                        ...newVariant,
                        stock: Number(e.target.value),
                      })
                    }
                    className="h-10 w-full rounded-xl border border-[#d9cbc0] px-3 text-sm"
                  />
                </div>

                {/* Add / Update */}
                <div className="pl-1">
                  <button
                    onClick={saveNewVariant}
                    className="h-10 w-full rounded-xl bg-[#5e473c] px-4 text-sm text-white"
                  >
                    {newVariant.id ? "Update" : "Add"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="h-fit rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-[#8b7a70]">
            Store preview
          </p>
          <div className="mt-4 aspect-[4/5] overflow-hidden rounded-2xl bg-[#f3e7d7]">
            {p.images[0] ? (
              <img
                src={src(
                  p.images.find((x) => x.isPrimary)?.url ?? p.images[0].url,
                )}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[#8b7a70]">
                Add a product image to preview it here.
              </div>
            )}
          </div>
          <h3 className="mt-4 font-serif text-2xl text-[#5e473c]">
            {p.name || "Untitled product"}
          </h3>
          <p className="mt-1 text-sm text-[#8b7a70]">
            ₹{Number(p.priceInr || 0).toLocaleString("en-IN")}
          </p>
          <p className="mt-4 text-xs leading-5 text-[#8b7a70]">
            The primary image is used on catalog cards. Image ordering controls
            the gallery order.
          </p>
        </aside>
      </div>
    </main>
  );
}
