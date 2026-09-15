'use client';

import { useState } from 'react';
import type { ProductVariant } from '../lib/types';
import { useCart } from './CartProvider';

export function AddToBag({ variants, disabled }: { variants: ProductVariant[]; disabled?: boolean }) {
  const { add } = useCart();
  const available = variants.filter((variant) => variant.stock > 0);
  const [selected, setSelected] = useState(available[0]?.id ?? variants[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    if (!selected) return;
    setBusy(true);
    setAdded(false);
    try {
      await add(selected, 1);
      setAdded(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not add this item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            disabled={variant.stock < 1 || busy}
            onClick={() => setSelected(variant.id)}
            className={`rounded-full border px-4 py-2 text-xs ${selected === variant.id ? 'border-[#5e473c] bg-[#5e473c] text-white' : 'border-[#d9cbc0] text-[#5e473c]'} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {variant.size}
          </button>
        ))}
      </div>
      <button
        disabled={disabled || busy || !selected || available.length === 0}
        onClick={handleAdd}
        className="w-full rounded-full bg-[#5e473c] px-6 py-3.5 text-sm font-medium text-[#fffaf3] transition hover:bg-[#3e302a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Adding…' : added ? 'Added to bag ✓' : disabled || available.length === 0 ? 'Sold out' : 'Add to bag'}
      </button>
    </div>
  );
}
