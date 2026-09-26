import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";

export function Price({ price, compareAt, className = "" }) {
  const onSale = compareAt && Number(compareAt) > Number(price);
  return (
    <span className={`font-mono ${className}`}>
      <span className={onSale ? "text-danger" : ""}>{formatPrice(price)}</span>
      {onSale && <s className="ml-2 text-ink-mute text-[0.85em]">{formatPrice(compareAt)}</s>}
    </span>
  );
}

export function StockNote({ stock }) {
  if (stock <= 0) return <span className="text-ink-mute">Sold out</span>;
  if (stock <= 5) return <span className="text-danger">Only {stock} left</span>;
  return <span className="text-emerald-700">In stock</span>;
}

export function QtyStepper({ value, max, onChange, label = "Quantity" }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white" role="group" aria-label={label}>
      <button type="button" className="h-10 w-10 text-lg disabled:opacity-30" onClick={() => onChange(value - 1)}
        disabled={value <= 1} aria-label="Decrease quantity">−</button>
      <span className="w-8 text-center font-mono" aria-live="polite">{value}</span>
      <button type="button" className="h-10 w-10 text-lg disabled:opacity-30" onClick={() => onChange(value + 1)}
        disabled={value >= max} aria-label="Increase quantity">+</button>
    </div>
  );
}

export function Button({ as: As = "button", variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-ink-soft",
    volt: "bg-volt text-ink hover:bg-volt-deep",
    ghost: "border border-line bg-white text-ink hover:border-ink",
    danger: "border border-danger/30 bg-white text-danger hover:bg-danger/5",
  };
  return (
    <As
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Alert({ children, tone = "error" }) {
  const tones = {
    error: "border-danger/30 bg-orange-50 text-danger",
    info: "border-line bg-white text-ink-soft",
    success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  };
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-ink-mute" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" />
      {label}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {children && <p className="mx-auto mt-2 max-w-md text-ink-mute">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const statusStyles = {
  pending_payment: "bg-amber-100 text-amber-900",
  processing: "bg-sky-100 text-sky-900",
  shipped: "bg-violet-100 text-violet-900",
  delivered: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ status, label }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[status] ?? ""}`}>
      {label}
    </span>
  );
}

export function PageTitle({ eyebrow, children, sub }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-mute">{eyebrow}</p>}
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{children}</h1>
      {sub && <p className="mt-2 text-ink-mute">{sub}</p>}
    </div>
  );
}

export const TextLink = (props) => <Link className="font-semibold underline decoration-volt-deep decoration-2 underline-offset-4 hover:decoration-ink" {...props} />;
