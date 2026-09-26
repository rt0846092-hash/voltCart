import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductArt from "../components/ProductArt";
import { Button, Empty, PageTitle, QtyStepper } from "../components/ui";
import { useCart } from "../lib/cart";
import { shippingFor, useConfig } from "../lib/config";
import { formatPrice } from "../lib/format";

export function Summary({ subtotal, children }) {
  const config = useConfig();
  const shipping = shippingFor(subtotal, config);
  const toFree = Number(config.free_shipping_over) - subtotal;
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <h2 className="font-display text-lg font-bold">Summary</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-mono">{formatPrice(subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Shipping</dt><dd className="font-mono">{shipping ? formatPrice(shipping) : "Free"}</dd></div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
          <dt>Total</dt><dd className="font-mono">{formatPrice(subtotal + shipping)}</dd>
        </div>
      </dl>
      {toFree > 0 && (
        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-ink-soft">
          Add {formatPrice(toFree)} more for free shipping.
        </p>
      )}
      {children}
    </div>
  );
}

export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  useEffect(() => { document.title = "Cart · Voltcart"; }, []);

  if (cart.items.length === 0) {
    return (
      <Empty title="Your cart is empty" action={<Button as={Link} to="/shop">Start shopping</Button>}>
        Find something you like and it will show up here.
      </Empty>
    );
  }

  return (
    <div>
      <PageTitle eyebrow="Cart">{cart.count} item{cart.count === 1 ? "" : "s"}</PageTitle>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-line rounded-2xl bg-white shadow-card">
          {cart.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-4">
              <Link to={`/product/${item.slug}`} className="w-28 shrink-0 overflow-hidden rounded-xl">
                <ProductArt product={item} className="aspect-[4/3] w-full" />
              </Link>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-ink-mute">{item.brand}</p>
                  <Link to={`/product/${item.slug}`} className="font-display font-bold hover:underline">{item.name}</Link>
                  <p className="font-mono text-sm text-ink-mute">{formatPrice(item.price)} each</p>
                </div>
                <div className="flex items-center gap-4">
                  <QtyStepper value={item.qty} max={Math.min(item.stock, cart.maxPerItem)} label={`Quantity of ${item.name}`}
                    onChange={(q) => cart.setQty(item.id, q)} />
                  <span className="w-24 text-right font-mono font-semibold">{formatPrice(item.price * item.qty)}</span>
                  <button onClick={() => cart.remove(item.id)} className="text-sm text-ink-mute hover:text-danger" aria-label={`Remove ${item.name}`}>
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div>
          <Summary subtotal={cart.subtotal}>
            <Button className="mt-5 w-full py-3" onClick={() => navigate("/checkout")}>Checkout</Button>
            <p className="mt-3 text-center text-xs text-ink-mute">Prices and stock are confirmed at checkout.</p>
          </Summary>
        </div>
      </div>
    </div>
  );
}
