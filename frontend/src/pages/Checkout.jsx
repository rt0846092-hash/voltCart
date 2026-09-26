import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Empty, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { useConfig } from "../lib/config";
import { formatPrice } from "../lib/format";
import { Summary } from "./Cart";

const FIELDS = [
  ["full_name", "Full name", "name", "sm:col-span-2"],
  ["email", "Email", "email", ""],
  ["phone", "Phone", "tel", ""],
  ["address", "Street address", "street-address", "sm:col-span-2"],
  ["city", "City", "address-level2", ""],
  ["postal_code", "Postal code", "postal-code", ""],
  ["country", "Country", "country-name", "sm:col-span-2"],
];

export default function Checkout() {
  const { user } = useAuth();
  const cart = useCart();
  const config = useConfig();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: user?.name ?? "", email: user?.email ?? "", phone: "", address: "", city: "", postal_code: "", country: "",
  });
  const [method, setMethod] = useState("cod");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Checkout · Voltcart"; }, []);
  useEffect(() => { if (config.card_payments) setMethod("card"); }, [config.card_payments]);

  if (cart.items.length === 0 && !busy) {
    return <Empty title="Nothing to check out" action={<Button as={Link} to="/shop">Go shopping</Button>} />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const order = await api("/orders/", {
        method: "POST",
        body: { ...form, payment_method: method, items: cart.items.map((i) => ({ product_id: i.id, quantity: i.qty })) },
      });
      cart.clear();
      if (order.checkout_url) {
        window.location.href = order.checkout_url; // off to Stripe's payment page
      } else {
        navigate(`/orders/${order.id}?placed=1`);
      }
    } catch (err) {
      setBusy(false);
      // If someone else bought the stock first, fix the cart so the customer can try again
      if (err.data?.product_id) cart.setStock(err.data.product_id, err.data.available ?? 0);
      setError(err.message);
    }
  };

  return (
    <div>
      <PageTitle eyebrow="Checkout">Almost yours</PageTitle>
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="font-display text-lg font-bold">Shipping details</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {FIELDS.map(([name, label, autoComplete, span]) => (
                <div key={name} className={span}>
                  <label className="label" htmlFor={name}>{label}</label>
                  <input id={name} className="field" required autoComplete={autoComplete}
                    type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
                    value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-2xl bg-white p-6 shadow-card">
            <legend className="font-display text-lg font-bold">Payment</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["card", "Card", config.card_payments ? "Pay securely on Stripe's checkout page." : "Not available right now.", !config.card_payments],
                ["cod", "Cash on delivery", "Pay in cash when your order arrives.", false],
              ].map(([value, title, text, disabled]) => (
                <label key={value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${method === value ? "border-ink ring-1 ring-ink" : "border-line"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
                  <input type="radio" name="payment" value={value} checked={method === value} disabled={disabled}
                    onChange={() => setMethod(value)} className="mt-1 accent-ink" />
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="text-sm text-ink-mute">{text}</span>
                  </span>
                </label>
              ))}
            </div>
            {method === "card" && (
              <p className="mt-4 rounded-lg bg-paper px-3 py-2 font-mono text-xs text-ink-soft">
                Test mode: use card 4242 4242 4242 4242, any future expiry date and any CVC.
              </p>
            )}
          </fieldset>
        </div>

        <div className="space-y-4">
          <Summary subtotal={cart.subtotal}>
            <ul className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              {cart.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span className="text-ink-soft">{i.qty} × {i.name}</span>
                  <span className="font-mono">{formatPrice(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <Button type="submit" className="mt-5 w-full py-3" disabled={busy}>
              {busy ? "Placing order…" : method === "card" ? "Continue to payment" : "Place order"}
            </Button>
          </Summary>
          {error && <Alert>{error}</Alert>}
        </div>
      </form>
    </div>
  );
}
