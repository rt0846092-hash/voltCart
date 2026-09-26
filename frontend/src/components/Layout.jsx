import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { useConfig } from "../lib/config";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
      <img src="/voltcart-icon.svg" alt="" className="h-8 w-8" />
      Voltcart
    </Link>
  );
}

function SearchBox({ onDone }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/shop?search=${encodeURIComponent(q.trim())}` : "/shop");
    setQ("");
    onDone?.();
  };
  return (
    <form onSubmit={submit} role="search" className="relative w-full">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search phones, laptops, audio…"
        aria-label="Search products"
        className="w-full rounded-full border border-line bg-white py-2 pl-4 pr-10 text-sm outline-none focus:border-ink"
      />
      <button className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-ink text-paper" aria-label="Search">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" strokeLinecap="round" /></svg>
      </button>
    </form>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const navClass = ({ isActive }) => `text-sm font-semibold ${isActive ? "text-ink" : "text-ink-mute hover:text-ink"}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-5 md:flex">
          <NavLink to="/shop" className={navClass} end>Shop</NavLink>
          {user && <NavLink to="/orders" className={navClass}>Orders</NavLink>}
          {user && <NavLink to="/account" className={navClass}>Account</NavLink>}
          {user?.is_staff && <NavLink to="/admin" className={navClass}>Dashboard</NavLink>}
        </nav>
        <div className="ml-auto hidden w-72 md:block"><SearchBox /></div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <button onClick={logout} className="hidden text-sm font-semibold text-ink-mute hover:text-ink md:block">Log out</button>
          ) : (
            <Link to="/login" className="hidden text-sm font-semibold text-ink-mute hover:text-ink md:block">Log in</Link>
          )}
          <Link to="/cart" className="relative flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper" aria-label={`Cart, ${count} items`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
            <span className="font-mono">{count}</span>
          </Link>
          <button className="grid h-9 w-9 place-items-center rounded-full border border-line md:hidden" onClick={() => setOpen((o) => !o)}
            aria-label="Menu" aria-expanded={open}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" stroke="currentColor" strokeWidth="2"><path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4 md:hidden">
          <SearchBox onDone={() => setOpen(false)} />
          <nav className="flex flex-col gap-3">
            <NavLink to="/shop" className={navClass}>Shop</NavLink>
            {user && <NavLink to="/orders" className={navClass}>My orders</NavLink>}
            {user && <NavLink to="/account" className={navClass}>Account</NavLink>}
            {user?.is_staff && <NavLink to="/admin" className={navClass}>Dashboard</NavLink>}
            {user ? (
              <button onClick={logout} className="text-left text-sm font-semibold text-ink-mute">Log out</button>
            ) : (
              <NavLink to="/login" className={navClass}>Log in</NavLink>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function DemoBar() {
  const { card_payments } = useConfig();
  return (
    <div className="bg-ink px-4 py-2 text-center font-mono text-[11px] tracking-wide text-paper/80">
      Demo store: nothing here is really for sale.
      {card_payments && <> Pay with test card <span className="text-volt">4242 4242 4242 4242</span>, any future date and CVC.</>}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink-mute sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <p>
          A portfolio project by{" "}
          <a className="font-semibold text-ink underline decoration-volt-deep decoration-2 underline-offset-4" href="https://github.com/rt0846092-hash" target="_blank" rel="noreferrer">Roshan Tamang</a>
          {" "}· React, Django REST, PostgreSQL, Stripe
        </p>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBar />
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
