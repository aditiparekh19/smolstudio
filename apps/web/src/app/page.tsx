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
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-7xl
            grid-cols-1
            gap-8
            px-5
            py-10
            sm:gap-10
            sm:px-6
            sm:py-14
            md:px-8
            md:py-16
            lg:grid-cols-[0.92fr_1.08fr]
            lg:gap-10
            lg:px-8
            lg:py-20
            xl:gap-14
            xl:py-24
          "
        >
          {/* =====================================================
              LEFT CONTENT
          ===================================================== */}
          <div className="flex flex-col justify-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#8b7a70]">
              SmolStudio / curated comfort
            </p>

            <h1
              className="
                max-w-2xl
                font-serif
                text-5xl
                leading-[0.98]
                tracking-[-0.045em]
                text-[#5e473c]
                sm:text-6xl
                lg:text-7xl
              "
            >
              Little clothes for very little people.
            </h1>

            <p
              className="
                mt-6
                max-w-xl
                text-base
                leading-7
                text-[#75645b]
                sm:text-lg
              "
            >
              Soft layers, playful details and thoughtful everyday pieces for
              0-1.5 years. Made to feel as good as they look.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#shop"
                className="
                  rounded-full
                  bg-[#5e473c]
                  px-6
                  py-3
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-[#4d392f]
                "
              >
                Shop the collection
              </a>

              <a
                href="#story"
                className="
                  rounded-full
                  border
                  border-[#cdbfb5]
                  px-6
                  py-3
                  text-sm
                  font-medium
                  text-[#5e473c]
                  transition
                  hover:bg-[#fffaf4]
                "
              >
                Our story
              </a>
            </div>
          </div>

          {/* =====================================================
              PEEKABOO BRAND CARD
          ===================================================== */}
          <div
  className="
    peekaboo-card
    relative
    isolate
    aspect-[1.15/0.82]
    w-full
    overflow-hidden
    rounded-[1.5rem]
    bg-[#eadfd3]
    sm:rounded-[1.75rem]
    md:aspect-[1.25/0.82]
    lg:aspect-[1.42/1]
    lg:rounded-[2rem]
  "
>
  {/* Background */}
  <div
    className="
      absolute
      inset-0
      bg-[radial-gradient(circle_at_30%_20%,#fff9f0,transparent_35%),linear-gradient(135deg,#f3e7d7,#e6d5c8)]
    "
  />

  {/* =====================================================
      BEAR
      The bear is BEHIND the curtain.
      Its left side remains visible.
  ===================================================== */}
  <div
    className="
      bear-peek
      absolute
      left-[39%]
      top-[20%]
      z-20
      w-[28%]
      max-w-[145px]
      min-w-[90px]
    "
  >
    <img
      src="/images/smolstudio-bear-exact.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className="
        block
        h-auto
        w-full
        select-none
        object-contain
      "
    />
  </div>

  {/* =====================================================
      CURTAIN
  ===================================================== */}
  <div
    className="
      curtain
      absolute
      right-0
      top-0
      z-30
      h-full
      w-[50%]
      rounded-l-[2.5rem]
      bg-[#f6ecdf]
    "
  >
    {/* Curtain folds */}
    <div
      className="
        absolute
        inset-y-0
        left-[8%]
        w-4
        rounded-full
        bg-[#eadbc9]/70
        sm:w-5
        md:w-6
      "
    />

    <div
      className="
        absolute
        inset-y-0
        left-[22%]
        w-5
        rounded-full
        bg-[#fffaf3]/80
        sm:w-6
        md:w-7
      "
    />

    <div
      className="
        absolute
        inset-y-0
        left-[38%]
        w-4
        rounded-full
        bg-[#eadbc9]/60
        sm:w-5
      "
    />

    <div
      className="
        absolute
        inset-y-0
        left-[53%]
        w-5
        rounded-full
        bg-[#fffaf3]/70
        sm:w-6
      "
    />

    <div
      className="
        absolute
        inset-y-0
        left-[68%]
        w-4
        rounded-full
        bg-[#eadbc9]/50
        sm:w-5
      "
    />

    {/* Hearts / stars */}
    <div className="absolute left-[18%] top-[18%] text-xs text-[#a78d7d] sm:text-sm">
      ♡
    </div>

    <div className="absolute right-[18%] top-[34%] text-xs text-[#a78d7d] sm:text-sm">
      ✦
    </div>

    <div className="absolute left-[38%] top-[64%] text-[10px] text-[#a78d7d] sm:text-xs">
      ✦
    </div>

    <div className="absolute right-[20%] bottom-[18%] text-xs text-[#a78d7d] sm:text-sm">
      ✦
    </div>

    <div className="absolute left-[28%] top-[10%] text-lg text-[#a78d7d] sm:text-xl">
      ♥
    </div>
  </div>

  {/* =====================================================
      CAPTION
  ===================================================== */}
  <div
    className="
      absolute
      bottom-5
      left-5
      z-40
      max-w-[48%]
      sm:bottom-7
      sm:left-7
      md:bottom-8
      md:left-8
    "
  >
    <p
      className="
        font-serif
        text-2xl
        italic
        leading-tight
        text-[#5e473c]
        sm:text-3xl
      "
    >
      Made for little moments.
    </p>

    <p
      className="
        mt-2
        text-xs
        leading-5
        text-[#7b685e]
        sm:text-sm
      "
    >
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
        className="
          mx-auto
          max-w-7xl
          px-5
          py-12
          sm:px-6
          md:px-8
          lg:py-16
        "
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b7a70]">
              The collection
            </p>

            <h2 className="mt-2 font-serif text-4xl tracking-[-0.03em] text-[#5e473c]">
              Made for tiny days
            </h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <a
              href="/"
              className="
                shrink-0
                rounded-full
                border
                border-[#cdbfb5]
                px-4
                py-2
                text-xs
                text-[#5e473c]
                transition
                hover:bg-[#fffaf4]
              "
            >
              All
            </a>

            {categories.map((category) => (
              <a
                key={category.id}
                href={`/?categorySlug=${category.slug}`}
                className="
                  shrink-0
                  rounded-full
                  border
                  border-[#e1d4ca]
                  bg-[#fffaf4]
                  px-4
                  py-2
                  text-xs
                  text-[#6d5b51]
                  transition
                  hover:border-[#cdbfb5]
                "
              >
                {category.name}
              </a>
            ))}
          </div>
        </div>

        <div
          className="
            mt-8
            grid
            grid-cols-2
            gap-x-3
            gap-y-9
            md:grid-cols-3
            lg:grid-cols-4
            lg:gap-x-5
          "
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* =========================================================
          STORY
      ========================================================= */}
      <section
        id="story"
        className="border-y border-[#eadfd5] bg-[#f3e7d7]/55"
      >
        <div
          className="
            mx-auto
            max-w-4xl
            px-5
            py-16
            text-center
            sm:px-6
            sm:py-20
            md:px-8
          "
        >
          <p
            className="
              font-serif
              text-3xl
              leading-tight
              tracking-[-0.03em]
              text-[#5e473c]
              sm:text-4xl
            "
          >
            Thoughtfully chosen. Playfully worn. Passed down when possible.
          </p>

          <p
            className="
              mx-auto
              mt-5
              max-w-2xl
              text-sm
              leading-7
              text-[#78665d]
            "
          >
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
