import { graphqlClient, categoriesQuery, productsQuery } from "../lib/graphql";
import type { ProductCard as ProductCardType } from "../lib/types";
import { ProductCard } from "../components/ProductCard";

export const revalidate = 60;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ categorySlug?: string }>;
}) {
  const params = await searchParams;
  const categorySlug = params.categorySlug;

  const [{ products }, { categories }] = await Promise.all([
    graphqlClient.request<{ products: ProductCardType[] }>(productsQuery, {
      limit: 24,
      categorySlug,
    }),
    graphqlClient.request<{
      categories: { id: string; slug: string; name: string }[];
    }>(categoriesQuery),
  ]);

  return (
    <main>
      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="border-b border-[#eadfd5]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:py-24">
          {/* Left content */}
          <div className="flex flex-col justify-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#8b7a70]">
              SmolStudio / curated comfort
            </p>

            <h1 className="max-w-2xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] text-[#5e473c] sm:text-6xl lg:text-7xl">
              Little clothes for very little people.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#75645b]">
              Soft layers, playful details and thoughtful everyday pieces for
              0-1.5 years. Made to feel as good as they look.
            </p>

            <div className="mt-8 flex gap-3">
              <a
                href="#shop"
                className="rounded-full bg-[#5e473c] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#4d392f]"
              >
                Shop the edit
              </a>

              <a
                href="#story"
                className="rounded-full border border-[#cdbfb5] px-6 py-3 text-sm font-medium text-[#5e473c] transition hover:bg-[#fffaf4]"
              >
                Our story
              </a>
            </div>
          </div>

          {/* =====================================================
              PEEKABOO BRAND CARD
          ===================================================== */}
          <div className="group relative min-h-[420px] overflow-hidden rounded-[2rem] bg-[#eadfd3]">
            {/* Soft background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#fff9f0,transparent_35%),linear-gradient(135deg,#f3e7d7,#e6d5c8)]" />

            {/* Subtle fabric glow */}
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#fffaf4]/40 blur-3xl" />

            {/* =================================================
                FLOATING HEARTS
            ================================================= */}
            <div className="heart-animation absolute right-[39%] top-[18%] z-30 text-2xl text-[#a78d7d] opacity-80">
              ♡
            </div>

            <div className="heart-animation-delayed absolute right-[33%] top-[12%] z-30 text-xl text-[#a78d7d] opacity-60">
              ♥
            </div>

            {/* Small decorative stars */}
            <div className="absolute right-[43%] top-[30%] z-30 text-xs text-[#b59d8e]">
              ✦
            </div>

            {/* =================================================
    PANDA / BABY PEEKING
================================================= */}
            <div className="peek-animation absolute right-[36%] top-[27%] z-10">
              <div className="relative h-40 w-32">
                {/* Ears */}
                <div className="absolute left-1 top-5 h-11 w-11 rounded-full bg-[#6d5147]" />
                <div className="absolute right-1 top-5 h-11 w-11 rounded-full bg-[#6d5147]" />

                {/* Head */}
                <div className="absolute left-2 top-3 h-32 w-32 rounded-full border-[3px] border-[#5e473c] bg-[#f8ead8] shadow-sm">
                  {/* Hair / top detail */}
                  <div className="absolute -top-1 left-11 h-6 w-14 rounded-full bg-[#5e473c]" />

                  {/* Eyes */}
                  <div className="absolute left-8 top-14 h-3.5 w-3.5 rounded-full bg-[#5e473c]" />
                  <div className="absolute right-8 top-14 h-3.5 w-3.5 rounded-full bg-[#5e473c]" />

                  {/* Cheeks */}
                  <div className="absolute left-4 top-[4.8rem] h-2.5 w-4 rounded-full bg-[#e8aaa0]/70" />
                  <div className="absolute right-4 top-[4.8rem] h-2.5 w-4 rounded-full bg-[#e8aaa0]/70" />

                  {/* Nose */}
                  <div className="absolute left-1/2 top-[4.8rem] h-2 w-2 -translate-x-1/2 rounded-full bg-[#5e473c]" />

                  {/* Smile */}
                  <div className="absolute left-1/2 top-[5.25rem] h-3 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#5e473c]" />
                </div>

                {/* Tiny hand */}
                <div className="absolute -right-1 bottom-1 h-9 w-9 rounded-full border-2 border-[#5e473c] bg-[#f8ead8]" />
              </div>
            </div>

            {/* =================================================
    CURTAIN
================================================= */}
            <div
              className="
    absolute right-0 top-0 z-20
    h-full w-[50%]
    rounded-l-[3rem]
    bg-[#f6ecdf]
    shadow-[-14px_0_35px_rgba(94,71,60,0.10)]
    transition-transform duration-700 ease-out
    group-hover:translate-x-3
  "
            >
              {/* Curtain folds */}
              <div className="absolute inset-y-0 left-[8%] w-6 rounded-full bg-[#eadbc9]/70" />

              <div className="absolute inset-y-0 left-[22%] w-7 rounded-full bg-[#fffaf3]/80" />

              <div className="absolute inset-y-0 left-[38%] w-5 rounded-full bg-[#eadbc9]/60" />

              <div className="absolute inset-y-0 left-[53%] w-6 rounded-full bg-[#fffaf3]/70" />

              <div className="absolute inset-y-0 left-[68%] w-5 rounded-full bg-[#eadbc9]/50" />

              {/* Soft edge highlight */}
              <div className="absolute inset-y-0 left-0 w-px bg-white/50" />

              {/* Stars */}
              <div className="absolute left-[18%] top-20 text-[#a78d7d]">✦</div>

              <div className="absolute right-[18%] top-36 text-sm text-[#a78d7d]">
                ✦
              </div>

              <div className="absolute left-[38%] top-64 text-xs text-[#a78d7d]">
                ✦
              </div>

              <div className="absolute right-[20%] bottom-28 text-[#a78d7d]">
                ✦
              </div>
            </div>

            {/* =================================================
                CAPTION
            ================================================= */}
            <div className="absolute bottom-8 left-8 z-30 max-w-xs">
              <p className="font-serif text-3xl italic leading-tight text-[#5e473c]">
                Made for little moments.
              </p>

              <p className="mt-2 text-sm text-[#7b685e]">
                A softer way to shop for growing days.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SHOP
      ========================================================= */}
      <section
        id="shop"
        className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b7a70]">
              The edit
            </p>

            <h2 className="mt-2 font-serif text-4xl tracking-[-0.03em] text-[#5e473c]">
              Made for tiny days
            </h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <a
              href="/"
              className="rounded-full border border-[#cdbfb5] px-4 py-2 text-xs text-[#5e473c] transition hover:bg-[#fffaf4]"
            >
              All
            </a>

            {categories.map((category) => (
              <a
                key={category.id}
                href={`/?categorySlug=${category.slug}`}
                className="rounded-full border border-[#e1d4ca] bg-[#fffaf4] px-4 py-2 text-xs text-[#6d5b51] transition hover:border-[#cdbfb5]"
              >
                {category.name}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* =========================================================
          STORY
      ========================================================= */}
      <section id="story" className="border-y border-[#eadfd5] bg-[#f3e7d7]/55">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <p className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#5e473c]">
            Thoughtfully chosen. Playfully worn. Passed down when possible.
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#78665d]">
            SmolStudio is a small-business-first storefront foundation. The
            first release focuses on beautiful browsing, dependable inventory
            and a checkout architecture that can grow without losing the quiet
            character of the brand.
          </p>
        </div>
      </section>
    </main>
  );
}
