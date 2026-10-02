import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ProductArt from "./ProductArt";
import { Alert, Button, Spinner } from "./ui";

const BLANK = {
  name: "", brand: "", category: "", tagline: "", description: "", price: "", compare_at_price: "", image_url: "",
  stock: 0, color: "#1f2937", specs: {}, is_active: true, featured: false,
};

/* Specs are edited as text: one "Name: Value" per line */
const specsToText = (specs) => Object.entries(specs || {}).map(([k, v]) => `${k}: ${v}`).join("\n");
const textToSpecs = (text) =>
  Object.fromEntries(
    text.split("\n").map((line) => line.split(/:(.*)/s).map((s) => s?.trim())).filter(([k, v]) => k && v)
  );

function ProductForm({ product, categories, onSaved, onClose }) {
  const isNew = !product.id;
  const [form, setForm] = useState({ ...BLANK, category: categories[0]?.slug ?? "", ...product, compare_at_price: product.compare_at_price ?? "", image_url: product.image_url ?? "" });
  const [specsText, setSpecsText] = useState(specsToText(product.specs));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      ...form,
      stock: Number(form.stock),
      compare_at_price: form.compare_at_price === "" ? null : form.compare_at_price,
      specs: textToSpecs(specsText),
    };
    delete body.id; delete body.slug; delete body.category_name;
    body.image_url = (form.image_url || "").trim();
    try {
      const saved = await api(isNew ? "/admin/products/" : `/admin/products/${product.id}/`, {
        method: isNew ? "POST" : "PATCH",
        body,
      });
      onSaved(saved, isNew);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const field = (name, label, props = {}) => (
    <div className={props.wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={`pf-${name}`}>{label}</label>
      <input id={`pf-${name}`} className="field" value={form[name]} onChange={set(name)} {...props} wide={undefined} />
    </div>
  );

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-xl font-bold">{isNew ? "Add a product" : `Edit ${product.name}`}</h3>
        <button type="button" onClick={onClose} className="text-ink-mute hover:text-ink" aria-label="Close">✕</button>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Name", { required: true, wide: true })}
          {field("brand", "Brand", { required: true })}
          <div>
            <label className="label" htmlFor="pf-category">Category</label>
            <select id="pf-category" className="field" value={form.category} onChange={set("category")} required>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          {field("price", "Price ($)", { required: true, inputMode: "decimal", placeholder: "99.00" })}
          {field("compare_at_price", "Original price ($)", { inputMode: "decimal", placeholder: "Only if on sale" })}
          {field("stock", "Stock", { required: true, type: "number", min: 0 })}
          <div>
            <label className="label" htmlFor="pf-color">Artwork colour</label>
            <div className="flex gap-2">
              <input id="pf-color" type="color" className="h-11 w-14 cursor-pointer rounded-xl border border-line" value={form.color} onChange={set("color")} />
              <input className="field font-mono" value={form.color} onChange={set("color")} aria-label="Colour hex code" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pf-image_url">Photo URL</label>
            <input id="pf-image_url" className="field" type="url" placeholder="https://images.unsplash.com/photo-…"
              value={form.image_url} onChange={set("image_url")} />
            <p className="mt-1 text-xs text-ink-mute">Optional. Use a photo you have the rights to, like a free Unsplash photo. Leave empty to show the drawing.</p>
          </div>
          {field("tagline", "Tagline", { required: true, wide: true, maxLength: 160 })}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pf-description">Description</label>
            <textarea id="pf-description" className="field min-h-24" required value={form.description} onChange={set("description")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pf-specs">Specs</label>
            <textarea id="pf-specs" className="field min-h-24 font-mono text-sm" value={specsText}
              onChange={(e) => setSpecsText(e.target.value)} placeholder={"Battery: 20 hours\nWeight: 250 g"} />
            <p className="mt-1 text-xs text-ink-mute">One per line, as Name: Value</p>
          </div>
          <div className="flex gap-6 text-sm sm:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-ink" checked={form.is_active} onChange={set("is_active")} /> Visible in the shop</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-ink" checked={form.featured} onChange={set("featured")} /> Featured on home page</label>
          </div>
        </div>
        <div>
          <p className="label">Preview</p>
          <div className="overflow-hidden rounded-xl border border-line">
            <ProductArt key={form.image_url} product={{ ...form, id: "preview", kind: categories.find((c) => c.slug === form.category)?.kind }} className="aspect-[4/3] w-full" />
          </div>
        </div>
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <div className="mt-5 flex gap-3">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : isNew ? "Add product" : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function QuickRow({ product, onSaved, onEdit }) {
  const [draft, setDraft] = useState({ price: product.price, stock: product.stock, is_active: product.is_active });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = draft.price !== product.price || Number(draft.stock) !== product.stock || draft.is_active !== product.is_active;

  useEffect(() => setDraft({ price: product.price, stock: product.stock, is_active: product.is_active }), [product]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      onSaved(await api(`/admin/products/${product.id}/`, {
        method: "PATCH",
        body: { price: draft.price, stock: Number(draft.stock), is_active: draft.is_active },
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className={product.is_active ? "" : "bg-paper/70 text-ink-mute"}>
      <td className="px-4 py-2.5">
        <p className="font-semibold">{product.name}</p>
        <p className="text-xs text-ink-mute">{product.brand} · {product.category_name}{product.featured && " · Featured"}</p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </td>
      <td className="px-4 py-2.5">
        <input className="field w-24 py-1.5 font-mono" inputMode="decimal" aria-label={`Price of ${product.name}`}
          value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
      </td>
      <td className="px-4 py-2.5">
        <input className={`field w-20 py-1.5 font-mono ${Number(draft.stock) <= 5 ? "text-danger" : ""}`} type="number" min="0"
          aria-label={`Stock of ${product.name}`} value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
      </td>
      <td className="px-4 py-2.5">
        <input type="checkbox" className="h-4 w-4 accent-ink" aria-label={`${product.name} visible in shop`}
          checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-2">
          <Button className="px-3 py-1 text-xs" disabled={!dirty || busy} onClick={save}>{busy ? "…" : "Save"}</Button>
          <Button variant="ghost" className="px-3 py-1 text-xs" onClick={onEdit}>Edit</Button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminProducts({ onChange }) {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/admin/products/").then(setProducts).catch((e) => setError(e.message));
    api("/categories/", { auth: false }).then(setCategories).catch(() => {});
  }, []);

  const saved = (product, isNew) => {
    setProducts((list) => (isNew ? [product, ...list] : list.map((p) => (p.id === product.id ? product : p))));
    setEditing(null);
    setNotice(isNew ? `${product.name} was added.` : `${product.name} was saved.`);
    onChange?.();
  };

  if (error) return <Alert>{error}</Alert>;
  if (!products) return <Spinner />;

  const q = search.trim().toLowerCase();
  const shown = q ? products.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(q)) : products;

  return (
    <div className="space-y-4">
      {editing ? (
        <ProductForm product={editing} categories={categories} onSaved={saved} onClose={() => setEditing(null)} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { setNotice(""); setEditing({}); }} disabled={!categories.length}>+ Add product</Button>
          <input className="field ml-auto w-full py-1.5 sm:w-60" placeholder="Search products" aria-label="Search products"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}
      {notice && !editing && <Alert tone="success">{notice}</Alert>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line font-mono text-xs uppercase tracking-widest text-ink-mute">
            <tr>{["Product", "Price ($)", "Stock", "Visible", ""].map((h) => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((p) => (
              <QuickRow key={p.id} product={p} onSaved={(prod) => saved(prod, false)}
                onEdit={() => { setNotice(""); setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-8 text-center text-ink-mute">No products match “{search}”.</p>}
      </div>
      <p className="text-xs text-ink-mute">
        Products are hidden instead of deleted, so past orders keep their details.
      </p>
    </div>
  );
}
