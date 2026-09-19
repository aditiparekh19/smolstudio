export const PRODUCT_SIZES = [
  "0-3M",
  "0-6M",
  "6-9M",
  "9-12M",
  "12-18M",
  "18-24M",
  "FREE",
] as const;

export type ProductSize = (typeof PRODUCT_SIZES)[number];
