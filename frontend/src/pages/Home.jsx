import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductArt from "../components/ProductArt";
import ProductCard from "../components/ProductCard";
import { Button, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useConfig } from "../lib/config";
import { formatPrice } from "../lib/format";

export default function Home() {
  const [featured, setFeatured] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const config = useConfig();

  useEffect(() => {
    document.title = "Voltcart — Electronics & Gadgets";
    api("/products/?featured=1&page_size=5", { auth: false })
      .then((d) => setFeatured(d.results))
      .catch((e) => setError(e.message));
    api("/categories/", { auth: false }).then(setCategories).catch(() => {});
  }, []);

  // The first featured product is the hero; the next four fill the grid
  const hero = featured?.[0];
  const grid = featured?.slice(1, 5);

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink-mute">New season · Free shipping over ${Number(config.free_shipping_over)}</p>
          <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            Gear that<br />
            <span className="relative inline-block">
              <span className="relative z-10">keeps up.</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-4 bg-volt sm:h-6" aria-hidden />
            </span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-ink-soft">
            Phones, laptops, audio and gaming gear, with honest specs and prices checked at checkout.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button as={Link} to="/shop">Shop everything</Button>
            <Button as={Link} to="/shop?on_sale=1" variant="ghost">See deals</Button>
          </div>
        </div>
        <Link to={hero ? `/product/${hero.slug}` : "/shop"} className="group relative block overflow-hidden rounded-3xl bg-white shadow-card">
          {hero ? (
            <>
              <ProductArt product={hero} className="aspect-[4/3] w-full transition duration-700 group-hover:scale-105" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-white/90 px-4 py-3 backdrop-blur">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-ink-mute">Featured</p>
                  <p className="font-display font-bold">{hero.name}</p>
                </div>
                <span className="font-mono font-semibold">{formatPrice(hero.price)}</span>
              </div>
            </>
          ) : (
            <div className="aspect-[4/3] w-full animate-pulse bg-line/50" />
          )}
        </Link>
      </section>

      {categories.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-bold">Shop by category</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c, i) => (
              <Link key={c.slug} to={`/shop?category=${c.slug}`}
                className="group overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5">
                <ProductArt product={{ id: `cat-${c.slug}`, kind: c.kind, color: ["#1e3a8a", "#334155", "#0f172a", "#0369a1", "#7c3aed", "#16a34a"][i % 6], name: c.name }}
                  className="aspect-[4/3] w-full" />
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="font-semibold">{c.name}</span>
                  <span className="font-mono text-xs text-ink-mute">{c.product_count}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">Featured</h2>
          <Link to="/shop" className="text-sm font-semibold text-ink-mute hover:text-ink">View all →</Link>
        </div>
        {error ? (
          <p className="mt-5 text-danger">{error}</p>
        ) : !featured ? (
          <Spinner />
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {grid.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-3xl bg-ink p-8 text-paper sm:grid-cols-3">
        {[
          ["Free shipping", `On every order over $${Number(config.free_shipping_over)}.`],
          ["Pay your way", config.card_payments ? "Card through Stripe, or cash on delivery." : "Cash on delivery, with card payments coming soon."],
          ["Real stock", "Stock updates live, so what you see is what we have."],
        ].map(([title, text]) => (
          <div key={title}>
            <p className="font-display text-lg font-bold text-volt">{title}</p>
            <p className="mt-1 text-sm text-paper/70">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
