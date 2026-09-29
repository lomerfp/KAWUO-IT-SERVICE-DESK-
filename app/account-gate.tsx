"use client";
import { useState } from "react";
import { ShieldCheck, UserRoundPlus } from "lucide-react";
import { STAFF_ROLES } from "../lib/roles";
export type Account = { id: string; email: string; name: string; department: string; role: string; status: "active" | "pending" | "disabled" | "unregistered"; admin: boolean; support: boolean; reports: boolean };
const requestedRoles = STAFF_ROLES;
export default function AccountGate({ account, reload }: { account: Account; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ name: account.name.includes("@") ? "" : account.name, department: "", role: "Staff" });
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { const res = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const data = await res.json() as { error?: string }; if (!res.ok) throw new Error(data.error || "Could not create profile."); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create profile."); }
    finally { setSaving(false); }
  }
  return <main className="auth-page"><div className="auth-shell"><section className="auth-story"><img src="/kawuo-logo.png" alt="KAWUO logo"/><div><span className="auth-overline">KARAMOJA WOMEN UMBRELLA ORGANISATION</span><h1>One place for every IT request.</h1><p>Your KAWUO account keeps your service history and feedback together.</p></div><div className="auth-story-foot">KAWUO · Private staff service desk</div></section><section className="auth-card profile-card"><div className="eyebrow">STAFF ACCOUNT</div>
    {account.status === "unregistered" ? <><h1>Create your staff profile</h1><p>You are signed in as <strong>{account.email}</strong>. Request a role below. IT will review it before you can use the service desk.</p><form onSubmit={submit} className="profile-form"><label>Full name<input required minLength={2} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><label>Department<input required minLength={2} maxLength={100} placeholder="e.g. Programmes" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}/></label><label>Requested role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{requestedRoles.map(role => <option key={role}>{role}</option>)}</select></label><p className="account-hint">Choosing a role requests approval; it does not grant access automatically. The Systems Administrator role is reserved for IT administration.</p>{error && <p className="inline-error" role="alert">{error}</p>}<button className="primary-button" disabled={saving}><UserRoundPlus size={17}/>{saving ? "Submitting…" : "Request account"}</button></form></> : <><div className="access-status-icon"><ShieldCheck size={28}/></div><h1>{account.status === "pending" ? "Account awaiting IT approval" : "Account access paused"}</h1><p>{account.status === "pending" ? `Your ${account.role} profile for ${account.email} is in the IT approval queue.` : `Your profile for ${account.email} is disabled. Contact the KAWUO Systems Administrator.`}</p><button className="secondary-button" onClick={() => void reload()}>Check again</button></>}
    <div className="access-links"><a href="/signout-with-chatgpt?return_to=/">Use another account</a><a href="https://help.openai.com/en/articles/4936828-resetting-or-changing-your-chatgpt-password" target="_blank" rel="noreferrer">Forgot password?</a></div>
  </section></div><footer className="auth-footer">© {new Date().getFullYear()} KAWUO · Systems Developer <strong>LOMER Francis Peter</strong>, IT-KAWUO</footer></main>;
}
