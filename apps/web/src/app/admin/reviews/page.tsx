"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import { apiClient, adminReviewsQuery, deleteAdminReviewMutation } from "../../../lib/graphql";
import type { AdminReview } from "../../../lib/types";

export default function AdminReviewsPage() {
  const { user, loading: authLoading } = useAuth();

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReviews() {
    setLoading(true);
    setError("");

    try {
      const result = await apiClient().request<{
        adminReviews: AdminReview[];
      }>(adminReviewsQuery);

      setReviews(result.adminReviews);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load reviews.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      !authLoading &&
      user &&
      (user.role === "ADMIN" || user.role === "STAFF")
    ) {
      void loadReviews();
    }
  }, [authLoading, user]);

  async function removeReview(id: string) {
    if (!window.confirm("Delete this review?")) {
      return;
    }

    try {
      await apiClient().request(
        deleteAdminReviewMutation,
        { id },
      );

      setReviews((current) =>
        current.filter((review) => review.id !== id),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to delete review.",
      );
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16">
        Loading reviews...
      </main>
    );
  }

  if (
    !user ||
    (user.role !== "ADMIN" && user.role !== "STAFF")
  ) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-16">
        <h1 className="font-serif text-5xl text-[#5e473c]">
          Reviews
        </h1>
        <p className="mt-4 text-[#8b7a70]">
          You need an admin account to access this area.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">
          Back office
        </p>

        <h1 className="mt-2 font-serif text-5xl text-[#5e473c]">
          Reviews
        </h1>

        <p className="mt-3 text-sm text-[#75645b]">
          Manage customer reviews across the store.
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-[#8b7a70]">
          Loading reviews...
        </p>
      ) : reviews.length === 0 ? (
        <div className="mt-10 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-8">
          <p className="font-serif text-2xl text-[#5e473c]">
            No reviews yet
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-4xl border border-[#eadfd5] bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#8b7a70]">
                    {review.productName}
                  </p>

                  <div className="mt-2 text-[#5e473c]">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </div>

                  {review.title && (
                    <h2 className="mt-2 font-serif text-2xl text-[#5e473c]">
                      {review.title}
                    </h2>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeReview(review.id)}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
                >
                  Delete
                </button>
              </div>

              {review.body && (
                <p className="mt-4 max-w-4xl text-sm leading-7 text-[#75645b]">
                  {review.body}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#8b7a70]">
                <span>
                  {review.customerName || "Customer"}
                </span>

                <span>{review.customerEmail}</span>

                <span>
                  {new Date(
                    review.createdAt,
                  ).toLocaleDateString("en-IN")}
                </span>

                <span>
                  {review.isPublished
                    ? "Published"
                    : "Hidden"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
