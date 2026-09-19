"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import {
  apiClient,
  productReviewsQuery,
  myProductReviewQuery,
  createProductReviewMutation,
  updateProductReviewMutation,
  deleteProductReviewMutation,
  canReviewProductQuery,
} from "../lib/graphql";
import type { ProductReview } from "../lib/types";

export default function ProductReviews({ productId }: { productId: string }) {
  const { user, loading: authLoading } = useAuth();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canReview, setCanReview] = useState(false);

  function formatReviewDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  async function loadReviews() {
    setLoading(true);

    try {
      const result = await apiClient().request<{
        productReviews: ProductReview[];
      }>(productReviewsQuery, { productId });

      setReviews(result.productReviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMyReview() {
    if (!user) {
      setMyReview(null);
      return;
    }

    try {
      const result = await apiClient().request<{
        myProductReview: ProductReview | null;
      }>(myProductReviewQuery, { productId });

      setMyReview(result.myProductReview);

      if (result.myProductReview) {
        setRating(result.myProductReview.rating);
        setTitle(result.myProductReview.title ?? "");
        setBody(result.myProductReview.body ?? "");
      }
    } catch {
      // Public reviews should still work if this request fails.
    }
  }

  async function loadCanReview() {
    if (!user) {
      setCanReview(false);
      return;
    }

    try {
      const result = await apiClient().request<{
        canReviewProduct: boolean;
      }>(canReviewProductQuery, { productId });

      setCanReview(result.canReviewProduct);
    } catch {
      setCanReview(false);
    }
  }

  useEffect(() => {
    void loadReviews();
  }, [productId]);

  useEffect(() => {
    if (!authLoading) {
      void loadMyReview();
      void loadCanReview();
    }
  }, [user, authLoading, productId]);

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();

    if (!body.trim()) {
      setError("Please write your review.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editing && myReview) {
        await apiClient().request(updateProductReviewMutation, {
          id: myReview.id,
          rating,
          title: title.trim() || null,
          body: body.trim(),
        });
      } else {
        await apiClient().request(createProductReviewMutation, {
          productId,
          rating,
          title: title.trim() || null,
          body: body.trim(),
        });
      }

      setEditing(false);
      await loadReviews();
      await loadMyReview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your review.");
    } finally {
      setSaving(false);
    }
  }

  async function removeReview() {
    if (!myReview) return;

    if (!window.confirm("Delete your review?")) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await apiClient().request(deleteProductReviewMutation, {
        id: myReview.id,
      });

      setMyReview(null);
      setEditing(false);
      setRating(5);
      setTitle("");
      setBody("");

      await loadReviews();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to delete your review.",
      );
    } finally {
      setSaving(false);
    }
  }

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  return (
    <section className="mt-20 border-t border-[#eadfd5] pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
            Customer notes
          </p>

          <h2 className="mt-2 font-serif text-4xl tracking-[-0.03em] text-[#5e473c]">
            Reviews
          </h2>
        </div>

        {reviews.length > 0 && (
          <div className="text-right text-sm text-[#75645b]">
            <div className="text-lg text-[#5e473c]">
              {"★".repeat(Math.round(average))}
              {"☆".repeat(5 - Math.round(average))}
            </div>

            <p>
              {average.toFixed(1)} · {reviews.length}{" "}
              {reviews.length === 1 ? "review" : "reviews"}
            </p>
          </div>
        )}
      </div>

      {user && canReview && (
        <div className="mt-8 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-serif text-2xl text-[#5e473c]">
              {editing
                ? "Edit your review"
                : myReview
                  ? "Your review"
                  : "Share your experience"}
            </h3>

            {myReview && !editing && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-full border border-[#cdbfb5] px-4 py-2 text-sm text-[#5e473c]"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={removeReview}
                  disabled={saving}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {(!myReview || editing) && (
            <form onSubmit={submitReview} className="mt-6 space-y-5">
              <div>
                <label className="block text-sm text-[#75645b]">Rating</label>

                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`text-2xl ${
                        value <= rating ? "text-[#5e473c]" : "text-[#cdbfb5]"
                      }`}
                      aria-label={`${value} stars`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Review title"
                maxLength={320}
                className="w-full rounded-2xl border border-[#d9ccc2] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b7a70]"
              />

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tell us about your experience..."
                maxLength={4000}
                rows={5}
                className="w-full resize-none rounded-2xl border border-[#d9ccc2] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b7a70]"
              />

              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save changes"
                      : "Post review"}
                </button>

                {editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-full border border-[#cdbfb5] px-6 py-3 text-sm text-[#5e473c]"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {myReview && !editing && (
            <div className="mt-5">
              <div className="text-[#5e473c]">
                {"★".repeat(myReview.rating)}
                {"☆".repeat(5 - myReview.rating)}
              </div>

              {myReview.title && (
                <h4 className="mt-2 font-medium text-[#332c28]">
                  {myReview.title}
                </h4>
              )}

              <p className="mt-2 text-sm leading-7 text-[#75645b]">
                {myReview.body}
              </p>
            </div>
          )}
        </div>
      )}

      {!authLoading && !user && (
        <p className="mt-8 text-sm text-[#8b7a70]">
          Sign in to share a review after purchasing this product.
        </p>
      )}

      <div className="mt-10">
        {loading ? (
          <p className="text-sm text-[#8b7a70]">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <div className="rounded-4xl border border-[#eadfd5] p-8 text-center">
            <p className="font-serif text-2xl text-[#5e473c]">No reviews yet</p>

            <p className="mt-2 text-sm text-[#8b7a70]">
              Be the first customer to share your experience.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-4xl border border-[#eadfd5] bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[#5e473c]">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </div>

                    {review.title && (
                      <h3 className="mt-2 font-serif text-2xl text-[#5e473c]">
                        {review.title}
                      </h3>
                    )}
                  </div>

                  <span className="text-xs text-[#a18e83]">
                    {formatReviewDate(review.createdAt)}
                  </span>
                </div>

                {review.body && (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-[#75645b]">
                    {review.body}
                  </p>
                )}

                <div className="mt-4 text-xs text-[#8b7a70]">
                  {review.customerName || "Verified customer"}
                  {" · "}
                  Verified purchase
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
