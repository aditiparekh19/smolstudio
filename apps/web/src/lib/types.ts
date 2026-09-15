export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceInr: number;
  compareAtPriceInr: number | null;
  imageUrl: string | null;
  categorySlug: string;
};

export type ProductVariant = { id: string; size: string; color: string; stock: number };

export type ProductImage = { id:string; url:string; altText:string|null; sortOrder:number; isPrimary:boolean };

export type Product = ProductCard & {
  sku: string;
  images: ProductImage[];
  sizes: string[];
  colors: string[];
  stock: number;
  variants: ProductVariant[];
};

export type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'CUSTOMER' | 'ADMIN' | 'STAFF';
};

export type CartItem = {
  id: string;
  variantId: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  priceInr: number;
  quantity: number;
  imageUrl: string | null;
  totalInr: number;
};

export type Cart = { id: string; items: CartItem[]; subtotalInr: number; count: number };
