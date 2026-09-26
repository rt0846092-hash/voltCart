import { Link } from "react-router-dom";
import ProductArt from "./ProductArt";
import { Price, StockNote } from "./ui";

export default function ProductCard({ product }) {
  return (
    <Link
      to={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <ProductArt product={product} className="h-full w-full transition duration-500 group-hover:scale-[1.04]" />
        {product.on_sale && (
          <span className="absolute left-3 top-3 rounded-full bg-volt px-2.5 py-1 font-mono text-[11px] font-semibold uppercase">Sale</span>
        )}
        {product.stock === 0 && (
          <span className="absolute inset-0 grid place-items-center bg-paper/60 font-mono text-xs font-semibold uppercase tracking-widest">Sold out</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-mute">{product.brand}</p>
        <h3 className="font-display text-lg font-bold leading-tight">{product.name}</h3>
        <p className="line-clamp-2 text-sm text-ink-mute">{product.tagline}</p>
        <div className="mt-auto flex items-end justify-between pt-3 text-sm">
          <Price price={product.price} compareAt={product.compare_at_price} className="text-base font-semibold" />
          <span className="text-xs"><StockNote stock={product.stock} /></span>
        </div>
      </div>
    </Link>
  );
}
