import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { Button, Empty, PageTitle, Spinner } from "../components/ui";
import { api } from "../lib/api";

const SORTS = [
  ["", "Featured"],
  ["price", "Price: low to high"],
  ["-price", "Price: high to low"],
  ["-created_at", "Newest"],
  ["name", "Name"],
];
const FILTER_KEYS = ["search", "category", "min_price", "max_price", "in_stock", "on_sale", "ordering", "page"];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const query = FILTER_KEYS.filter((k) => params.get(k)).map((k) => `${k}=${encodeURIComponent(params.get(k))}`).join("&");
  const page = Number(params.get("page") || 1);
  const activeCategory = categories.find((c) => c.slug === params.get("category"));

  useEffect(() => {
    api("/categories/", { auth: false }).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    setError("");
    api(`/products/?${query}`, { auth: false }).then(setData).catch((e) => setError(e.message));
  }, [query]);

  useEffect(() => {
    document.title = `${activeCategory?.name ?? "Shop"} · Voltcart`;
  }, [activeCategory]);

  // Changing any filter goes back to page 1
  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  const [prices, setPrices] = useState({ min: params.get("min_price") || "", max: params.get("max_price") || "" });
  const applyPrices = (e) => {
    e.preventDefault();
    update({ min_price: prices.min, max_price: prices.max });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.count / 12)) : 1;
  const search = params.get("search");
  const hasFilters = FILTER_KEYS.some((k) => k !== "ordering" && k !== "page" && params.get(k));

  return (
    <div>
      <PageTitle eyebrow={search ? "Search" : "Shop"} sub={data ? `${data.count} product${data.count === 1 ? "" : "s"}` : " "}>
        {search ? `“${search}”` : activeCategory?.name ?? (params.get("on_sale") ? "Deals" : "All products")}
      </PageTitle>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className={`${showFilters ? "block" : "hidden"} space-y-8 lg:block`} aria-label="Filters">
          <div>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-mute">Category</h2>
            <ul className="space-y-1">
              {[{ slug: "", name: "All", product_count: null }, ...categories].map((c) => (
                <li key={c.slug || "all"}>
                  <button onClick={() => update({ category: c.slug })}
                    className={`flex w-full justify-between rounded-lg px-3 py-1.5 text-left text-sm ${
                      (params.get("category") || "") === c.slug ? "bg-ink text-paper" : "hover:bg-white"}`}>
                    {c.name}
                    {c.product_count != null && <span className="font-mono text-xs opacity-60">{c.product_count}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={applyPrices}>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-mute">Price</h2>
            <div className="flex items-center gap-2">
              <input className="field py-1.5" inputMode="decimal" placeholder="Min" aria-label="Minimum price"
                value={prices.min} onChange={(e) => setPrices({ ...prices, min: e.target.value })} />
              <span className="text-ink-mute">–</span>
              <input className="field py-1.5" inputMode="decimal" placeholder="Max" aria-label="Maximum price"
                value={prices.max} onChange={(e) => setPrices({ ...prices, max: e.target.value })} />
            </div>
            <Button variant="ghost" className="mt-2 w-full py-1.5">Apply</Button>
          </form>

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={params.get("in_stock") === "1"}
                onChange={(e) => update({ in_stock: e.target.checked ? "1" : "" })} />
              In stock only
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={params.get("on_sale") === "1"}
                onChange={(e) => update({ on_sale: e.target.checked ? "1" : "" })} />
              On sale
            </label>
          </div>

          {hasFilters && (
            <button className="text-sm font-semibold underline underline-offset-4"
              onClick={() => { setPrices({ min: "", max: "" }); setParams({}); }}>
              Clear all filters
            </button>
          )}
        </aside>

        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <Button variant="ghost" className="lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              {showFilters ? "Hide filters" : "Filters"}
            </Button>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-ink-mute">Sort</span>
              <select className="field w-auto py-1.5" value={params.get("ordering") || ""}
                onChange={(e) => update({ ordering: e.target.value })}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>

          {error ? (
            <Empty title="Couldn't load products">{error}</Empty>
          ) : !data ? (
            <Spinner />
          ) : data.results.length === 0 ? (
            <Empty title="Nothing matches" action={<Button onClick={() => setParams({})}>Clear filters</Button>}>
              Try a different search or fewer filters.
            </Empty>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.results.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              {totalPages > 1 && (
                <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pages">
                  <Button variant="ghost" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>← Previous</Button>
                  <span className="font-mono text-sm">{page} / {totalPages}</span>
                  <Button variant="ghost" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>Next →</Button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
