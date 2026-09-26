import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Empty, Spinner, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";

const STEPS = [
  ["placed", "Order placed"],
  ["processing", "Confirmed"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
];
const REACHED = { pending_payment: 0, processing: 1, shipped: 2, delivered: 3 };

function Timeline({ status }) {
  const reached = REACHED[status] ?? 0;
  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map(([key, label], i) => (
        <li key={key} className="text-center">
          <div className={`h-1.5 rounded-full ${i <= reached ? "bg-ink" : "bg-line"}`} />
          <p className={`mt-2 text-xs sm:text-sm ${i <= reached ? "font-semibold" : "text-ink-mute"}`}>{label}</p>
        </li>
      ))}
    </ol>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const cameBackPaid = params.get("payment") === "success";

  const load = useCallback(() => api(`/orders/${id}/`).then((o) => { setOrder(o); return o; }), [id]);

  useEffect(() => {
    document.title = "Order · Voltcart";
    load().catch(setError);
  }, [load]);

  // Just back from Stripe: the payment can take a few seconds to be confirmed
  useEffect(() => {
    if (!cameBackPaid || order?.status !== "pending_payment") return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const o = await load().catch(() => null);
      if (!o || o.status !== "pending_payment" || tries >= 10) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [cameBackPaid, order?.status, load]);

  const cancel = async () => {
    if (!window.confirm("Cancel this order? The items will go back in stock.")) return;
    setBusy(true);
    try {
      const o = await api(`/orders/${id}/cancel/`, { method: "POST" });
      setOrder(o);
      setNotice(o.status === "cancelled" ? "Your order was cancelled." : "Your payment went through, so the order wasn't cancelled.");
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Empty title={error.status === 404 ? "Order not found" : "Couldn't load this order"}
        action={<Button as={Link} to="/orders">My orders</Button>}>
        {error.status === 404 ? "It may belong to a different account." : error.message}
      </Empty>
    );
  }
  if (!order) return <Spinner />;

  const pending = order.status === "pending_payment";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {params.get("placed") && order.status === "processing" && (
        <Alert tone="success">Thanks! Your order is confirmed. We've emailed you the details.</Alert>
      )}
      {cameBackPaid && order.paid && <Alert tone="success">Payment received. Thanks for your order!</Alert>}
      {cameBackPaid && pending && <Alert tone="info">Confirming your payment…</Alert>}
      {params.get("payment") === "cancelled" && pending && (
        <Alert tone="info">Payment wasn't completed. Your items are held for 30 minutes, so you can try again.</Alert>
      )}
      {notice && <Alert tone="info">{notice}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-mute">Order</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{order.number}</h1>
          <p className="text-sm text-ink-mute">Placed {formatDate(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} label={order.status_display} />
      </div>

      {order.status !== "cancelled" && (
        <div className="rounded-2xl bg-white p-6 shadow-card"><Timeline status={order.status} /></div>
      )}

      {(pending || order.can_cancel) && (
        <div className="flex flex-wrap gap-3">
          {pending && order.checkout_url && (
            <Button as="a" href={order.checkout_url}>Complete payment</Button>
          )}
          {order.can_cancel && (
            <Button variant="danger" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel order"}</Button>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-card">
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 px-6 py-3 text-sm">
              <span>
                {i.quantity} ×{" "}
                {i.product_slug ? <Link to={`/product/${i.product_slug}`} className="font-semibold hover:underline">{i.product_name}</Link> : i.product_name}
              </span>
              <span className="font-mono">{formatPrice(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-line px-6 py-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-mono">{formatPrice(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd className="font-mono">{Number(order.shipping) ? formatPrice(order.shipping) : "Free"}</dd></div>
          <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd className="font-mono">{formatPrice(order.total)}</dd></div>
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 text-sm shadow-card">
          <h2 className="mb-2 font-display font-bold">Shipping to</h2>
          <p>{order.full_name}</p>
          <p className="text-ink-mute">{order.address}, {order.city} {order.postal_code}, {order.country}</p>
          <p className="text-ink-mute">{order.phone}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 text-sm shadow-card">
          <h2 className="mb-2 font-display font-bold">Payment</h2>
          <p>{order.payment_method_display}</p>
          <p className="text-ink-mute">
            {order.paid ? `Paid ${formatDate(order.paid_at)}` : order.payment_method === "cod" ? "Pay when it arrives" : "Not paid yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
