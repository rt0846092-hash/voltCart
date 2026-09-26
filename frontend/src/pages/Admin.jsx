import { useCallback, useEffect, useState } from "react";
import { Alert, Button, PageTitle, Spinner, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";

const DJANGO_ADMIN = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "") + "/admin/";

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-mute">{label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

function OrderRow({ order, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const move = async (status) => {
    if (status === "cancelled" && !window.confirm(`Cancel ${order.number}? Stock will be restored.`)) return;
    setBusy(true);
    setError("");
    try {
      onChange(await api(`/admin/orders/${order.id}/`, { method: "PATCH", body: { status } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="align-top">
      <td className="px-4 py-3 font-mono font-semibold">{order.number}</td>
      <td className="px-4 py-3">
        <p>{order.full_name}</p>
        <p className="text-xs text-ink-mute">{order.customer}</p>
      </td>
      <td className="px-4 py-3 text-ink-mute">{formatDate(order.created_at)}</td>
      <td className="px-4 py-3">
        {order.items.map((i) => <p key={i.id} className="whitespace-nowrap text-xs">{i.quantity} × {i.product_name}</p>)}
      </td>
      <td className="px-4 py-3">
        <p className="font-mono">{formatPrice(order.total)}</p>
        <p className="text-xs text-ink-mute">{order.payment_method === "card" ? "Card" : "Cash"} · {order.paid ? "paid" : "unpaid"}</p>
      </td>
      <td className="px-4 py-3"><StatusBadge status={order.status} label={order.status_display} /></td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {order.next_statuses.map((s) => (
            <Button key={s.value} variant={s.value === "cancelled" ? "danger" : "ghost"} className="px-3 py-1 text-xs"
              disabled={busy} onClick={() => move(s.value)}>
              {s.value === "cancelled" ? "Cancel" : `Mark ${s.label.toLowerCase()}`}
            </Button>
          ))}
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState(null);
  const [status, setStatus] = useState("processing");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadStats = useCallback(() => api("/admin/stats/").then(setStats).catch((e) => setError(e.message)), []);

  useEffect(() => {
    document.title = "Dashboard · Voltcart";
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setOrders(null);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (search.trim()) q.set("search", search.trim());
    const timer = setTimeout(() => {
      api(`/admin/orders/?${q}`).then((d) => setOrders(d.results)).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [status, search]);

  const updateOrder = (updated) => {
    setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)).filter((o) => !status || o.status === status));
    loadStats();
  };

  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner />;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle eyebrow="Staff">Dashboard</PageTitle>
        <Button as="a" href={DJANGO_ADMIN} target="_blank" rel="noreferrer" variant="ghost" className="mb-8">
          Edit products & stock ↗
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Revenue · 30 days" value={formatPrice(stats.revenue_30d)} hint="Paid orders only" />
        <Stat label="Orders · 30 days" value={stats.orders_30d} />
        <Stat label="To ship" value={stats.to_ship} hint="Confirmed and waiting" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="font-display font-bold">Low stock</h2>
          {stats.low_stock.length === 0 ? (
            <p className="mt-2 text-sm text-ink-mute">Everything is well stocked.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {stats.low_stock.map((p) => (
                <li key={p.slug} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className={`font-mono ${p.stock === 0 ? "text-danger" : ""}`}>{p.stock === 0 ? "sold out" : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="font-display font-bold">Best sellers · 30 days</h2>
          {stats.top_products.length === 0 ? (
            <p className="mt-2 text-sm text-ink-mute">No sales yet.</p>
          ) : (
            <ol className="mt-3 space-y-1.5 text-sm">
              {stats.top_products.map((p, i) => (
                <li key={p.product_name} className="flex justify-between">
                  <span><span className="mr-2 font-mono text-ink-mute">{i + 1}</span>{p.product_name}</span>
                  <span className="font-mono">{p.sold} sold</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-4 font-display text-xl font-bold">Orders</h2>
          {[{ status: "", label: "All" }, ...stats.by_status].map((s) => (
            <button key={s.status || "all"} onClick={() => setStatus(s.status)}
              className={`rounded-full px-3 py-1 text-sm ${status === s.status ? "bg-ink text-paper" : "bg-white hover:bg-line/50"}`}>
              {s.label}{s.count != null && <span className="ml-1.5 font-mono text-xs opacity-60">{s.count}</span>}
            </button>
          ))}
          <input className="field ml-auto w-full py-1.5 sm:w-60" placeholder="Search name, email, VC-00012"
            aria-label="Search orders" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-card">
          {!orders ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <p className="p-8 text-center text-ink-mute">No orders here.</p>
          ) : (
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line font-mono text-xs uppercase tracking-widest text-ink-mute">
                <tr>{["Order", "Customer", "Date", "Items", "Total", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => <OrderRow key={o.id} order={o} onChange={updateOrder} />)}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
