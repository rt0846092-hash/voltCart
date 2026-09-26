import { useEffect, useState } from "react";
import { Alert, Button, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

function ProfileForm() {
  const { user, updateSession } = useAuth();
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      updateSession(await api("/auth/me/", { method: "PATCH", body: { name } }));
      setStatus({ tone: "success", text: "Your name was updated." });
    } catch (err) {
      setStatus({ tone: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-card">
      <h2 className="font-display text-lg font-bold">Profile</h2>
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" className="field" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="field bg-paper text-ink-mute" value={user.email} disabled />
        <p className="mt-1 text-xs text-ink-mute">Your email is your login and can't be changed.</p>
      </div>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <Button type="submit" disabled={busy || name.trim() === user.name}>{busy ? "Saving…" : "Save"}</Button>
    </form>
  );
}

function PasswordForm() {
  const { updateSession } = useAuth();
  const empty = { current_password: "", new_password: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (form.new_password !== form.confirm) {
      setStatus({ tone: "error", text: "The new passwords don't match." });
      return;
    }
    setBusy(true);
    try {
      const data = await api("/auth/change-password/", {
        method: "POST",
        body: { current_password: form.current_password, new_password: form.new_password },
      });
      updateSession(data); // new tokens, so you stay logged in
      setForm(empty);
      setStatus({ tone: "success", text: "Password changed. Use your new password next time you log in." });
    } catch (err) {
      setStatus({ tone: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-card">
      <h2 className="font-display text-lg font-bold">Change password</h2>
      <div>
        <label className="label" htmlFor="current_password">Current password</label>
        <input id="current_password" type="password" className="field" required autoComplete="current-password"
          value={form.current_password} onChange={set("current_password")} />
      </div>
      <div>
        <label className="label" htmlFor="new_password">New password</label>
        <input id="new_password" type="password" className="field" required minLength={8} autoComplete="new-password"
          value={form.new_password} onChange={set("new_password")} />
        <p className="mt-1 text-xs text-ink-mute">At least 8 characters, not too common.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" type="password" className="field" required minLength={8} autoComplete="new-password"
          value={form.confirm} onChange={set("confirm")} />
      </div>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <Button type="submit" disabled={busy}>{busy ? "Changing…" : "Change password"}</Button>
    </form>
  );
}

export default function Account() {
  useEffect(() => { document.title = "Account · Voltcart"; }, []);
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Account">Your account</PageTitle>
      <div className="space-y-6">
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}
