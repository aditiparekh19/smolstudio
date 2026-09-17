"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addToCartMutation,
  apiClient,
  cartQuery,
  removeCartItemMutation,
  updateCartItemMutation,
} from "../lib/graphql";
import type { Cart, CartItem } from "../lib/types";
import { useAuth } from "./AuthProvider";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalInr: number;
  loading: boolean;
  add: (variantId: string, quantity?: number) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function getOrCreateToken() {
  const existing = localStorage.getItem("smolstudio-cart-token");
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem("smolstudio-cart-token", token);
  return token;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState("");
  const [cart, setCart] = useState<Cart>({
    id: "",
    items: [],
    subtotalInr: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => setToken(getOrCreateToken()), []);

  const refresh = useCallback(async () => {
    if (authLoading) return;

    setLoading(true);

    try {
      const headers = token ? { "x-cart-token": token } : undefined;

      const result = await apiClient(headers).request<{ cart: Cart }>(
        cartQuery,
      );

      setCart(result.cart);
    } finally {
      setLoading(false);
    }
  }, [token, user, authLoading]);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  const value = useMemo<CartContextValue>(
    () => ({
      items: cart.items,
      count: cart.count,
      subtotalInr: cart.subtotalInr,
      loading,
      add: async (variantId, quantity = 1) => {
        const headers = token ? { "x-cart-token": token } : undefined;

        const result = await apiClient(headers).request<{ addToCart: Cart }>(
          addToCartMutation,
          { variantId, quantity },
        );

        setCart(result.addToCart);
      },
      update: async (itemId, quantity) => {
        const headers = token ? { "x-cart-token": token } : undefined;

        const result = await apiClient(headers).request<{
          updateCartItem: Cart;
        }>(updateCartItemMutation, { itemId, quantity });

        setCart(result.updateCartItem);
      },
      remove: async (itemId) => {
        const headers = token ? { "x-cart-token": token } : undefined;

        const result = await apiClient(headers).request<{
          removeCartItem: Cart;
        }>(removeCartItemMutation, { itemId });

        setCart(result.removeCartItem);
      },
      refresh,
    }),
    [cart, loading, refresh, token],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
