import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Empty, PageTitle, Spinner, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "My orders · Voltcart";
    api("/orders/").then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <Empty title="Couldn't load your orders">{error}</Empty>;
  if (!orders) return <Spinner />;

  return (
    <div>
      <PageTitle eyebrow="Account">My orders</PageTitle>
      {orders.length === 0 ? (
        <Empty title="No orders yet" action={<Button as={Link} to="/shop">Start shopping</Button>} />
      ) : (
        <ul className="divide-y divide-line rounded-2xl bg-white shadow-card">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 hover:bg-paper/60">
                <span className="font-mono font-semibold">{o.number}</span>
                <span className="text-sm text-ink-mute">{formatDate(o.created_at)}</span>
                <span className="text-sm text-ink-mute">{o.items.reduce((n, i) => n + i.quantity, 0)} items</span>
                <StatusBadge status={o.status} label={o.status_display} />
                <span className="ml-auto font-mono font-semibold">{formatPrice(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
