import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const KEY = "vc_cart";
const MAX_PER_ITEM = 10;

const loadCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const limitFor = (product) => Math.min(product.stock, MAX_PER_ITEM);

/* The cart is kept in the browser; the server checks prices and stock at checkout. */
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or blocked */ }
  }, [items]);

  const value = useMemo(() => {
    const add = (product, qty = 1) =>
      setItems((current) => {
        const existing = current.find((i) => i.id === product.id);
        const snapshot = {
          id: product.id, slug: product.slug, name: product.name, brand: product.brand,
          price: product.price, color: product.color, kind: product.category?.kind ?? product.kind,
          image_url: product.image_url, stock: product.stock,
        };
        if (existing) {
          return current.map((i) =>
            i.id === product.id ? { ...snapshot, qty: Math.min(i.qty + qty, limitFor(product)) } : i
          );
        }
        return [...current, { ...snapshot, qty: Math.min(qty, limitFor(product)) }];
      });

    const setQty = (id, qty) =>
      setItems((current) =>
        current.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(qty, limitFor(i))) } : i))
      );

    // After a failed checkout, lower a line to what's actually available
    const setStock = (id, stock) =>
      setItems((current) =>
        stock <= 0
          ? current.filter((i) => i.id !== id)
          : current.map((i) => (i.id === id ? { ...i, stock, qty: Math.min(i.qty, stock) } : i))
      );

    const remove = (id) => setItems((current) => current.filter((i) => i.id !== id));
    const clear = () => setItems([]);

    const count = items.reduce((n, i) => n + i.qty, 0);
    const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);

    return { items, add, setQty, setStock, remove, clear, count, subtotal, maxPerItem: MAX_PER_ITEM };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
