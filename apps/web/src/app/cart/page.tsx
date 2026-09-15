'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '../../components/CartProvider';

export default function CartPage() {
  const { items, subtotalInr, update, remove, loading } = useCart();

  return (
    <main className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">Your bag</p>
      <h1 className="mt-2 font-serif text-5xl tracking-[-0.04em] text-[#5e473c]">Little things, gathered.</h1>

      {loading && items.length === 0 ? (
        <p className="mt-10 text-sm text-[#8b7a70]">Loading your bag…</p>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-10 text-center">
          <p className="font-serif text-2xl text-[#5e473c]">Your bag is empty.</p>
          <Link href="/" className="mt-5 inline-block rounded-full bg-[#5e473c] px-6 py-3 text-sm text-white">Browse the edit</Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f1e5d7]">
                  <Image
                    src={item.slug === 'sunny-fruit-vest' ? '/products/sunny-fruit-vest.png' : item.imageUrl ?? `https://placehold.co/300x380/F3E7D7/5E473C?text=${encodeURIComponent(item.name)}`}
                    alt={item.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.slug}`} className="font-medium text-[#332c28] hover:underline">{item.name}</Link>
                  <p className="mt-1 text-sm text-[#8b7a70]">Size {item.size} · {item.color}</p>
                  <p className="mt-1 text-sm text-[#5e473c]">₹{item.priceInr.toLocaleString('en-IN')}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => void update(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="h-8 w-8 rounded-full border border-[#d9cbc0] disabled:opacity-40">−</button>
                    <span className="min-w-6 text-center text-sm">{item.quantity}</span>
                    <button onClick={() => void update(item.id, item.quantity + 1)} className="h-8 w-8 rounded-full border border-[#d9cbc0]">+</button>
                    <button onClick={() => void remove(item.id)} className="ml-3 text-xs text-[#8b7a70] underline">Remove</button>
                  </div>
                </div>
                <span className="text-sm text-[#332c28]">₹{item.totalInr.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-[2rem] border border-[#eadfd5] bg-[#fffaf4] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8b7a70]">Summary</p>
            <div className="mt-5 flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotalInr.toLocaleString('en-IN')}</span></div>
            <p className="mt-2 text-xs leading-5 text-[#8b7a70]">Shipping and payment will be added at checkout.</p>
            <Link href="/checkout" className="mt-6 block rounded-full bg-[#5e473c] px-6 py-4 text-center text-sm font-medium text-white">Continue to checkout</Link>
          </aside>
        </div>
      )}
    </main>
  );
}
