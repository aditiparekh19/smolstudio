import Link from "next/link";
export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#fbf7f0] text-[#5e473c]">
      {" "}
      {/* Hero */}{" "}
      <section className="mx-auto max-w-7xl px-5 pb-14 pt-14 lg:px-8 lg:pb-20 lg:pt-20">
        {" "}
        <div className="max-w-3xl">
          {" "}
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9b877a]">
            {" "}
            SmolStudio / contact{" "}
          </p>{" "}
          <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            {" "}
            We'd love <br /> to hear from you.{" "}
          </h1>{" "}
          <p className="mt-7 max-w-2xl text-base leading-7 text-[#78675e] sm:text-lg">
            {" "}
            Have a question about an order, sizing, fabrics or anything else?
            Send us a little note and we'll get back to you.{" "}
          </p>{" "}
        </div>{" "}
      </section>{" "}
      {/* Contact cards */}{" "}
      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8 lg:pb-28">
        {" "}
        <div className="grid gap-5 md:grid-cols-3">
          {" "}
          {/* Email */}{" "}
          <a
            href="mailto:hello@smolstudio.in"
            className="group rounded-4xl border border-[#eadfd5] bg-[#fffdf9] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(94,71,60,0.08)] sm:p-8"
          >
            {" "}
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e9df] text-lg text-[#7d685c]">
              {" "}
              @{" "}
            </div>{" "}
            <p className="mt-8 text-xs font-medium uppercase tracking-[0.16em] text-[#9b877a]">
              {" "}
              Email{" "}
            </p>{" "}
            <h2 className="mt-2 font-serif text-2xl text-[#5e473c]">
              {" "}
              Say hello{" "}
            </h2>{" "}
            <p className="mt-3 text-sm leading-6 text-[#78675e]">
              {" "}
              For questions, orders and everything in between.{" "}
            </p>{" "}
            <span className="mt-6 block text-sm text-[#6d5b51] group-hover:text-[#252321]">
              {" "}
              hello@smolstudio.in →{" "}
            </span>{" "}
          </a>{" "}
          {/* WhatsApp */}{" "}
          <a
            href="https://wa.me/917709219989"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-4xl border border-[#eadfd5] bg-[#fffdf9] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(94,71,60,0.08)] sm:p-8"
          >
            {" "}
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e9df] text-sm text-[#7d685c]">
              {" "}
              ↗{" "}
            </div>{" "}
            <p className="mt-8 text-xs font-medium uppercase tracking-[0.16em] text-[#9b877a]">
              {" "}
              WhatsApp{" "}
            </p>{" "}
            <h2 className="mt-2 font-serif text-2xl text-[#5e473c]">
              {" "}
              Send a message{" "}
            </h2>{" "}
            <p className="mt-3 text-sm leading-6 text-[#78675e]">
              {" "}
              For quick questions or help with your order.{" "}
            </p>{" "}
            <span className="mt-6 block text-sm text-[#6d5b51] group-hover:text-[#252321]">
              {" "}
              Message us →{" "}
            </span>{" "}
          </a>{" "}
          {/* Instagram */}{" "}
          <a
            href="https://www.instagram.com/smolstudio_/"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-4xl border border-[#eadfd5] bg-[#fffdf9] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(94,71,60,0.08)] sm:p-8"
          >
            {" "}
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e9df] text-lg text-[#7d685c]">
              {" "}
              ◎{" "}
            </div>{" "}
            <p className="mt-8 text-xs font-medium uppercase tracking-[0.16em] text-[#9b877a]">
              {" "}
              Instagram{" "}
            </p>{" "}
            <h2 className="mt-2 font-serif text-2xl text-[#5e473c]">
              {" "}
              Come say hello{" "}
            </h2>{" "}
            <p className="mt-3 text-sm leading-6 text-[#78675e]">
              {" "}
              Little clothes, little moments and everything SmolStudio.{" "}
            </p>{" "}
            <span className="mt-6 block text-sm text-[#6d5b51] group-hover:text-[#252321]">
              {" "}
              Follow along →{" "}
            </span>{" "}
          </a>{" "}
        </div>{" "}
      </section>{" "}
      {/* Friendly note */}{" "}
      <section className="border-t border-[#eadfd5]">
        {" "}
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          {" "}
          <div className="grid gap-10 rounded-4xl bg-[#f3e9df] p-8 sm:p-10 md:grid-cols-[1fr_auto] md:items-center lg:p-12">
            {" "}
            <div>
              {" "}
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9b877a]">
                {" "}
                Need help with an order?{" "}
              </p>{" "}
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.03em] text-[#5e473c] sm:text-4xl">
                {" "}
                We're happy to help.{" "}
              </h2>{" "}
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#78675e]">
                {" "}
                You can also find your order details and account information in
                your SmolStudio account.{" "}
              </p>{" "}
            </div>{" "}
            <Link
              href="/account"
              className="inline-flex w-fit rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white transition-colors hover:bg-[#49372f]"
            >
              {" "}
              Go to my account{" "}
            </Link>{" "}
          </div>{" "}
        </div>{" "}
      </section>{" "}
    </main>
  );
}
