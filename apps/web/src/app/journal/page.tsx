import Link from "next/link";
const postcards = [
  {
    number: "01",
    category: "Fabric notes",
    title: "Why muslin cotton?",
    text: "Lightweight, breathable and gentle, muslin cotton is a beautiful choice for little ones. Its open weave allows air to move freely, while the fabric becomes softer with every wash.",
  },
  {
    number: "02",
    category: "Little guides",
    title: "What should babies wear?",
    text: "For babies, comfort comes first. Soft, breathable fabrics, relaxed fits and easy openings can make everyday dressing simpler for both baby and parent.",
  },
  {
    number: "03",
    category: "Everyday comfort",
    title: "A softer first layer",
    text: "A baby’s skin is delicate, which is why the first layer matters. Natural, breathable fabrics can help make those everyday moments feel a little gentler.",
  },
  {
    number: "04",
    category: "Wardrobe notes",
    title: "Less, but better",
    text: "Babies do not need complicated wardrobes. A small collection of comfortable pieces that are easy to wash, layer and change can go a surprisingly long way.",
  },
  {
    number: "05",
    category: "Design notes",
    title: "Simple clothes, easier days",
    text: "Thoughtful details matter. Easy openings, comfortable fits and fewer unnecessary fastenings can make getting dressed a much happier little ritual.",
  },
  {
    number: "06",
    category: "Little guides",
    title: "Made for little movement",
    text: "Stretching, kicking, rolling, sleeping and discovering - babies are always moving. Their clothes should move with them, not get in the way.",
  },
];
export default function JournalPage() {
  return (
    <main className="min-h-screen bg-[#fbf7f0] text-[#5e473c]">
      {" "}
      {/* Hero */}{" "}
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-20">
        {" "}
        <div className="max-w-3xl">
          {" "}
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9b877a]">
            {" "}
            SmolStudio / journal{" "}
          </p>{" "}
          <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.04em] text-[#5e473c] sm:text-6xl lg:text-7xl">
            {" "}
            Little notes <br /> for little ones.{" "}
          </h1>{" "}
          <p className="mt-7 max-w-2xl text-base leading-7 text-[#78675e] sm:text-lg">
            {" "}
            Small things we have learned about dressing, wrapping and caring for
            babies - collected here for curious parents.{" "}
          </p>{" "}
        </div>{" "}
      </section>{" "}
      {/* Postcards */}{" "}
      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8 lg:pb-28">
        {" "}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {postcards.map((postcard) => (
            <article
              key={postcard.number}
              className="group flex min-h-[330px] flex-col rounded-4xl border border-[#eadfd5] bg-[#fffdf9] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(94,71,60,0.08)] sm:p-8"
            >
              {" "}
              <div className="flex items-start justify-between">
                {" "}
                <span className="text-xs font-medium tracking-[0.16em] text-[#b09d90]">
                  {" "}
                  {postcard.number}{" "}
                </span>{" "}
                <span className="rounded-full bg-[#f3e9df] px-3 py-1.5 text-[10px] tracking-[0.12em] text-[#8b776b]">
                  {" "}
                  {postcard.category}{" "}
                </span>{" "}
              </div>{" "}
              <div className="mt-auto">
                {" "}
                <h2 className="font-serif text-3xl leading-tight tracking-[-0.025em] text-[#5e473c]">
                  {" "}
                  {postcard.title}{" "}
                </h2>{" "}
                <p className="mt-4 text-sm leading-6 text-[#78675e]">
                  {" "}
                  {postcard.text}{" "}
                </p>{" "}
              </div>{" "}
            </article>
          ))}{" "}
        </div>{" "}
      </section>{" "}
      {/* Closing note */}{" "}
      <section className="border-t border-[#eadfd5]">
        {" "}
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          {" "}
          <div className="rounded-4xl bg-[#f3e9df] px-7 py-12 text-center sm:px-10">
            {" "}
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9b877a]">
              {" "}
              A little reminder{" "}
            </p>{" "}
            <h2 className="mx-auto mt-4 max-w-2xl font-serif text-3xl leading-tight tracking-[-0.03em] text-[#5e473c] sm:text-4xl">
              {" "}
              The best baby clothes are the ones they can simply be themselves
              in.{" "}
            </h2>{" "}
            <Link
              href="/#shop"
              className="mt-7 inline-flex rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white transition-colors hover:bg-[#49372f]"
            >
              {" "}
              Shop the collection{" "}
            </Link>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </main>
  );
}
