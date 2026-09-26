import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button } from "../components/ui";
import { useAuth } from "../lib/auth";

function AuthForm({ mode }) {
  const isLogin = mode === "login";
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next") : "/";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `${isLogin ? "Log in" : "Create account"} · Voltcart`; }, [isLogin]);
  useEffect(() => { if (user) navigate(next, { replace: true }); }, [user, next, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const other = `${isLogin ? "/register" : "/login"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{isLogin ? "Welcome back" : "Create account"}</h1>
      <p className="mt-2 text-ink-mute">{isLogin ? "Log in to check out and track orders." : "It takes 20 seconds."}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {!isLogin && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="field" required autoComplete="name" value={form.name} onChange={set("name")} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="field" required autoComplete="email" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="field" required minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"} value={form.password} onChange={set("password")} />
          {!isLogin && <p className="mt-1 text-xs text-ink-mute">At least 8 characters, not too common.</p>}
        </div>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full py-3" disabled={busy}>
          {busy ? "One moment…" : isLogin ? "Log in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-mute">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link to={other} className="font-semibold text-ink underline underline-offset-4">{isLogin ? "Create an account" : "Log in"}</Link>
      </p>
    </div>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
