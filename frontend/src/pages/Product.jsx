import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductArt from "../components/ProductArt";
import ProductCard from "../components/ProductCard";
import { Button, Empty, Price, QtyStepper, Spinner, StockNote } from "../components/ui";
import { api } from "../lib/api";
import { useCart } from "../lib/cart";
import { useConfig } from "../lib/config";
import { formatPrice } from "../lib/format";

export default function Product() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const cart = useCart();
  const config = useConfig();

  useEffect(() => {
    setProduct(null);
    setError(null);
    setQty(1);
    api(`/products/${slug}/`, { auth: false })
      .then((p) => {
        setProduct(p);
        document.title = `${p.name} · Voltcart`;
        return api(`/products/?category=${p.category.slug}&page_size=5`, { auth: false });
      })
      .then((d) => setRelated(d.results.filter((r) => r.slug !== slug).slice(0, 4)))
      .catch((e) => setError(e));
  }, [slug]);

  if (error) {
    return (
      <Empty title={error.status === 404 ? "Product not found" : "Couldn't load this product"}
        action={<Button as={Link} to="/shop">Back to shop</Button>}>
        {error.status === 404 ? "It may have been removed." : error.message}
      </Empty>
    );
  }
  if (!product) return <Spinner />;

  const inCart = cart.items.find((i) => i.id === product.id)?.qty ?? 0;
  const maxAdd = Math.max(0, Math.min(product.stock, cart.maxPerItem) - inCart);

  const addToCart = () => {
    cart.add(product, qty);
    setAdded(true);
    setQty(1);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div>
      <nav className="mb-6 font-mono text-xs text-ink-mute" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-ink">Shop</Link> /{" "}
        <Link to={`/shop?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link> /{" "}
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-white shadow-card">
          <ProductArt product={product} className="aspect-[4/3] w-full" />
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-mute">{product.brand}</p>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">{product.name}</h1>
          <p className="mt-2 text-lg text-ink-soft">{product.tagline}</p>

          <div className="mt-6 flex items-center gap-4">
            <Price price={product.price} compareAt={product.compare_at_price} className="text-2xl font-semibold" />
            {product.on_sale && (
              <span className="rounded-full bg-volt px-2.5 py-1 font-mono text-xs font-semibold">
                Save {formatPrice(product.compare_at_price - product.price)}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm"><StockNote stock={product.stock} /></p>

          {product.stock > 0 ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {maxAdd > 0 ? (
                <>
                  <QtyStepper value={Math.min(qty, maxAdd)} max={maxAdd} onChange={setQty} />
                  <Button onClick={addToCart} className="px-7 py-3">Add to cart</Button>
                </>
              ) : (
                <p className="text-sm text-ink-mute">You have the maximum available in your cart.</p>
              )}
              {inCart > 0 && <Button as={Link} to="/cart" variant="ghost" className="py-3">View cart ({inCart})</Button>}
            </div>
          ) : (
            <Button disabled className="mt-6">Sold out</Button>
          )}
          <p className="mt-3 h-5 text-sm text-emerald-700" aria-live="polite">{added && "✓ Added to your cart"}</p>

          <p className="mt-6 leading-relaxed text-ink-soft">{product.description}</p>

          {Object.keys(product.specs).length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-lg font-bold">Specs</h2>
              <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-ink-mute">{k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <p className="mt-6 text-sm text-ink-mute">
            Free shipping on orders over ${Number(config.free_shipping_over)} · 30-day returns
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold">More in {product.category.name}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
