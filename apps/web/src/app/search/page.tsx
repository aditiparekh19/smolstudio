import Link from 'next/link';
import { graphqlClient, productsQuery } from '../../lib/graphql';
import type { ProductCard as ProductCardType } from '../../lib/types';
import { ProductCard } from '../../components/ProductCard';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { products } = await graphqlClient.request<{ products: ProductCardType[] }>(productsQuery, { limit: 60, search: q || undefined });
  return <main className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">Search</p><h1 className="mt-2 font-serif text-5xl text-[#5e473c]">Find something little.</h1><form className="mt-8 flex gap-3"><input name="q" defaultValue={q} placeholder="Search vests, newborn, sets…" className="min-w-0 flex-1 rounded-full border border-[#d9cbc0] bg-[#fffaf4] px-5 py-3 outline-none"/><button className="rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white">Search</button></form>{q && <p className="mt-8 text-sm text-[#8b7a70]">{products.length} result{products.length===1?'':'s'} for “{q}”.</p>}<div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>{q && products.length===0 && <div className="mt-10 rounded-4xl border border-[#eadfd5] bg-[#fffaf4] p-10 text-center"><p className="font-serif text-2xl text-[#5e473c]">Nothing matched that search.</p><Link href="/" className="mt-5 inline-block text-sm underline">Back to the collection</Link></div>}</main>;
}
