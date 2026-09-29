"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, ChevronDown, ClipboardList, Clock3, Headphones, Home, LayoutDashboard, Menu, MessageSquareText, Plus, Search, Send, SlidersHorizontal, Ticket as TicketIcon, Users, Monitor, FileBarChart2, X } from "lucide-react";
import AccountGate, { type Account } from "./account-gate";
import StaffDirectory from "./staff-directory";
import RemoteDesk from "./remote-desk";
import MonthlyReport from "./monthly-report";
import TicketFeedback from "./ticket-feedback";

type Ticket = {
  id: string; requester_id: string; requester_name: string; requester_email: string;
  kind: string; category: string; priority: string; title: string; description: string;
  location: string; status: string; assignee: string; resolution_notes: string;
  created_at: string; updated_at: string; resolved_at: string | null; is_sample: number;
};
type View = "queue" | "mine" | "new" | "metrics" | "staff" | "remote" | "report";
const categories = ["Hardware", "Software", "Network & internet", "Email & accounts", "Printer", "QuickBooks", "Data & M&E", "Security & access", "Website", "Other"];
const statuses = ["New", "In progress", "Waiting", "Reopened", "Resolved"];
const priorities = ["Low", "Medium", "High", "Urgent"];
const date = (s: string) => new Date(s).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
const pct = (n: number, d: number) => d ? Math.round(n / d * 100) : 0;
type Metrics = { total:number; open:number; new:number; resolved:number; urgent:number; sampleCount:number; byStatus:Record<string,number>; byPriority:Record<string,number> };
const emptyMetrics: Metrics = { total:0, open:0, new:0, resolved:0, urgent:0, sampleCount:0, byStatus:{}, byPriority:{} };

export default function ServiceDesk() {
  const latestLoad = useRef(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [total, setTotal] = useState(0), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);
  const [assignees, setAssignees] = useState<{email:string;name:string;role:string}[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [support, setSupport] = useState(false);
  const [user, setUser] = useState({ name: "", email: "" });
  const [view, setView] = useState<View>("queue");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ kind: "Incident", category: "Hardware", priority: "Medium", title: "", description: "", location: "" });
  const [edit, setEdit] = useState({ status: "New", priority: "Medium", category: "Hardware", assignee: "", resolutionNotes: "" });

  useEffect(() => { const id = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(id); }, [search]);
  const load = useCallback(async () => {
    const run = ++latestLoad.current;
    setLoading(true);
    try {
      const accountResponse = await fetch("/api/account", { cache: "no-store" });
      const accountData = await accountResponse.json() as { account?: Account; error?: string };
      if (run !== latestLoad.current) return;
      if (!accountResponse.ok || !accountData.account) throw new Error(accountData.error || "Could not load account.");
      setAccount(accountData.account);
      if (accountData.account.status !== "active") { setTickets([]); setError(""); return; }
      const query = new URLSearchParams({ view: view === "mine" ? "mine" : "queue", page: String(page) });
      if (debouncedSearch) query.set("q", debouncedSearch);
      if (statusFilter !== "All statuses") query.set("status", statusFilter);
      if (categoryFilter !== "All categories") query.set("category", categoryFilter);
      if (priorityFilter !== "All priorities") query.set("priority", priorityFilter);
      if (view === "queue" && assigneeFilter) query.set("assignee", assigneeFilter);
      const res = await fetch(`/api/tickets?${query}`, { cache: "no-store" });
      const data = await res.json() as { error?: string; tickets: Ticket[]; support: boolean; user: {name: string; email: string}; total:number; page:number; pageSize:number; metrics:Metrics };
      if (run !== latestLoad.current) return;
      if (!res.ok) throw new Error(data.error || "Could not load tickets.");
      setTickets(data.tickets);
      setMetrics(data.metrics); setTotal(data.total); setPageSize(data.pageSize);
      if (data.page !== page) setPage(data.page);
      setSupport(data.support);
      setUser(data.user);
      setView(v => data.support ? v : v === "queue" || v === "metrics" ? "mine" : v);
      setError("");
    } catch (e) { if (run === latestLoad.current) setError(e instanceof Error ? e.message : "Could not load tickets."); }
    finally { if (run === latestLoad.current) setLoading(false); }
  }, [view, page, debouncedSearch, statusFilter, categoryFilter, priorityFilter, assigneeFilter]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!support) return; let live = true; void fetch("/api/staff?assignees=1", {cache:"no-store"}).then(r => r.json()).then(d => { const data = d as {staff?: {email:string;name:string;role:string}[]}; if (live) setAssignees(data.staff || []); }).catch(() => {}); return () => { live = false; }; }, [support]);

  const visible = tickets;
  const activeTicket = tickets.find(t => t.id === selected);
  const open = (t: Ticket) => { setSelected(t.id); setEdit({ status: t.status, priority: t.priority, category: t.category, assignee: t.assignee, resolutionNotes: t.resolution_notes }); setError(""); };
  const changeView = (v: View) => { setView(v); setPage(1); setSelected(null); setMobileNav(false); setError(""); setNotice(""); };
  const counts = metrics;
  const sampleCount = metrics.sampleCount;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json() as { error?: string; tickets: Ticket[]; support: boolean; user: {name: string; email: string}; id: string };
      if (!res.ok) throw new Error(data.error || "Could not submit request.");
      setForm({ kind: "Incident", category: "Hardware", priority: "Medium", title: "", description: "", location: "" });
      setPage(1); setView("mine"); setNotice(`Request ${data.id} submitted. IT support can now review it.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit request."); }
    finally { setSaving(false); }
  }
  async function update(e: React.FormEvent) {
    e.preventDefault(); if (!activeTicket) return; setSaving(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/tickets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeTicket.id, ...edit }) });
      const data = await res.json() as { error?: string; tickets: Ticket[]; support: boolean; user: {name: string; email: string}; id: string };
      if (!res.ok) throw new Error(data.error || "Could not save ticket.");
      await load(); setSelected(null); setNotice(`${activeTicket.id} updated.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save ticket."); }
    finally { setSaving(false); }
  }

  const nav = [
    ...(support ? [{ key: "queue" as View, label: "Support queue", icon: LayoutDashboard }] : []),
    { key: "mine" as View, label: "My requests", icon: ClipboardList },
    { key: "new" as View, label: "New request", icon: Plus },
    { key: "remote" as View, label: "Remote assistance", icon: Monitor },
    ...(support ? [{ key: "metrics" as View, label: "Service metrics", icon: BarChart3 }] : []),
    ...(account?.reports ? [{ key: "report" as View, label: "Monthly report", icon: FileBarChart2 }] : []),
    { key: "staff" as View, label: "People & roles", icon: Users },
  ];
  if (account && account.status !== "active") return <AccountGate account={account} reload={load}/>;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <div className="brand"><button className="brand-home" onClick={() => changeView(support ? "queue" : "mine")} aria-label="KAWUO home dashboard" title="Home"><img className="brand-logo" src="/kawuo-logo.png" alt=""/></button><div><strong>KAWUO</strong><span>IT SERVICE DESK</span></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="nav-list">{nav.map(n => <button key={n.key} className={`nav-item ${view === n.key ? "active" : ""}`} onClick={() => changeView(n.key)}><n.icon size={19} strokeWidth={1.8}/><span>{n.label}</span>{n.key === "queue" && counts.new > 0 && <em>{counts.new}</em>}</button>)}</nav>
      <div className="side-bottom"><div className="help-card"><div className="help-icon"><Headphones size={22}/></div><strong>Need IT assistance?</strong><p>Submit a request with a clear description. You can follow progress here.</p><button onClick={() => changeView("new")}>Create a ticket <ArrowUpRight size={15}/></button></div><div className="sidebar-foot">Internal service portal <span>•</span> KAWUO</div></div>
    </aside>
    {mobileNav && <button className="nav-shade" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={23}/></button><button className="header-home" onClick={() => changeView(support ? "queue" : "mine")} aria-label="KAWUO home dashboard" title="Home"><img className="header-logo" src="/kawuo-logo.png" alt=""/></button><div className="top-path">IT SERVICE DESK <span>/</span> {view === "queue" ? "SUPPORT QUEUE" : view === "mine" ? "MY REQUESTS" : view === "new" ? "NEW REQUEST" : view === "remote" ? "REMOTE ASSISTANCE" : view === "report" ? "MONTHLY REPORT" : view === "staff" ? "PEOPLE & ROLES" : "SERVICE METRICS"}</div><div className="top-quick-nav"><button onClick={() => changeView(support ? "queue" : "mine")}><Home size={16}/> Home</button><button onClick={() => changeView("new")}><Plus size={16}/> New ticket</button></div><div className="top-right"><span className="private-chip"><span/> PRIVATE WORKSPACE</span><span className="account-role">{account?.role}</span><a className="signout-link" href="/signout-with-chatgpt?return_to=/">Sign out</a><div className="avatar" title={user.email || "Signed-in user"}>{(user.name || "K").split(/[\s@.]+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join("")}</div></div></header>
      <div className="content">
        {error && <div className="banner error" role="alert">{error}<button onClick={() => { setError(""); void load(); }}>Retry</button></div>}
        {notice && <div className="banner success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16}/></button></div>}
        {view === "staff" ? <StaffDirectory admin={Boolean(account?.admin)}/> : view === "remote" ? <RemoteDesk support={support}/> : view === "report" && account?.reports ? <MonthlyReport/> : view === "new" ? <>
          <div className="page-heading"><div><div className="eyebrow">REQUEST SUPPORT</div><h1>New IT request</h1><p>Tell us what happened and where. Your request will appear under My requests.</p></div></div>
          <form className="request-form" onSubmit={submit}><div className="form-section"><div className="section-number">01</div><div><h2>What do you need help with?</h2><p>Choose the request type and the area it relates to.</p></div></div>
            <div className="type-choice">{["Incident", "Service request"].map(k => <label key={k} className={`type-card ${form.kind === k ? "chosen" : ""}`}><input type="radio" name="kind" checked={form.kind === k} onChange={() => setForm({ ...form, kind: k })}/><span className="type-icon">{k === "Incident" ? <Activity size={21}/> : <TicketIcon size={21}/>}</span><strong>{k}</strong><small>{k === "Incident" ? "Something is broken or not working" : "Access, setup or a new IT service"}</small></label>)}</div>
            <div className="form-grid"><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{priorities.map(p => <option key={p}>{p}</option>)}</select><small>Choose Urgent only when work is seriously blocked.</small></label></div>
            <div className="form-divider"/><div className="form-section"><div className="section-number">02</div><div><h2>Describe the request</h2><p>Include any error message and what you have already tried.</p></div></div>
            <label className="full-field">Short title<input required minLength={5} maxLength={120} placeholder="e.g. Shared printer is not connecting" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
            <label className="full-field">Description<textarea required minLength={10} maxLength={3000} rows={6} placeholder="Describe the issue or service you need..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
            <label className="full-field">Location <span className="optional">Optional</span><input maxLength={120} placeholder="e.g. Moroto office, Finance desk" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}/></label>
            <div className="form-actions"><button type="button" className="secondary-button" onClick={() => changeView("mine")}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Submitting…" : <><Send size={17}/> Submit request</>}</button></div>
          </form>
        </> : view === "metrics" && support ? <>
          <div className="page-heading"><div><div className="eyebrow">SERVICE OVERVIEW</div><h1>Service metrics</h1><p>A snapshot of requests currently in the desk.</p></div></div>
          {sampleCount > 0 && <div className="sample-note">Includes {sampleCount} clearly marked example tickets. Metrics will reflect them until they are removed in a future setup step.</div>}
          <div className="metric-grid"><Metric label="Total requests" value={counts.total} icon={<TicketIcon/>}/><Metric label="Open requests" value={counts.open} icon={<Clock3/>}/><Metric label="Resolved" value={counts.resolved} icon={<CheckCircle2/>}/><Metric label="Resolution rate" value={`${pct(counts.resolved, counts.total)}%`} icon={<BarChart3/>}/></div>
          <div className="charts-grid"><div className="panel"><div className="panel-heading"><h2>Status breakdown</h2><span>All tickets</span></div>{statuses.map(s => <div className="bar-row" key={s}><div><strong>{s}</strong><span>{counts.byStatus[s] || 0}</span></div><div className="bar-track"><div className={`bar-fill ${s.toLowerCase().replace(" ", "-")}`} style={{ width: `${pct(counts.byStatus[s] || 0, counts.total)}%` }}/></div></div>)}</div><div className="panel"><div className="panel-heading"><h2>Priority mix</h2><span>All tickets</span></div>{priorities.map(p => <div className="bar-row" key={p}><div><strong>{p}</strong><span>{counts.byPriority[p] || 0}</span></div><div className="bar-track"><div className={`bar-fill priority-${p.toLowerCase()}`} style={{ width: `${pct(counts.byPriority[p] || 0, counts.total)}%` }}/></div></div>)}</div></div>
        </> : <>
          <div className="page-heading"><div><div className="eyebrow">{view === "queue" ? "SUPPORT WORKSPACE" : "YOUR WORKSPACE"}</div><h1>{view === "queue" ? "Support queue" : "My requests"}</h1><p>{view === "queue" ? "Review, assign and resolve requests from across the organisation." : "Follow the progress of requests you have submitted."}</p></div><button className="primary-button" onClick={() => changeView("new")}><Plus size={18}/> New request</button></div>
          {view === "mine" && counts.resolved > 0 && <div className="feedback-callout"><MessageSquareText size={18}/><span>Open a resolved request to confirm whether the fix worked or ask IT to continue.</span></div>}
          {view === "queue" && <><div className="metric-grid"><Metric label="Open requests" value={counts.open} icon={<TicketIcon/>}/><Metric label="Awaiting triage" value={counts.new} icon={<Clock3/>}/><Metric label="Urgent & open" value={counts.urgent} icon={<Activity/>}/><Metric label="Resolved" value={counts.resolved} icon={<CheckCircle2/>}/></div>{sampleCount > 0 && <div className="sample-note">Example data: {sampleCount} sample tickets are marked below. New requests save separately.</div>}</>}
          <section className="ticket-panel"><div className="panel-heading list-head"><div><h2>{view === "queue" ? "All tickets" : "Your tickets"}</h2><span>{total} {total === 1 ? "request" : "requests"} found</span></div><div className="list-icon"><SlidersHorizontal size={18}/></div></div>
            <div className="filter-row"><label className="search-box"><Search size={18}/><input aria-label="Search tickets" placeholder="Search tickets..." value={search} onChange={e => {setSearch(e.target.value);setPage(1);}}/></label><div className="select-wrap"><select aria-label="Filter by status" value={statusFilter} onChange={e => {setStatusFilter(e.target.value);setPage(1);}}><option>All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={15}/></div><div className="select-wrap"><select aria-label="Filter by category" value={categoryFilter} onChange={e => {setCategoryFilter(e.target.value);setPage(1);}}><option>All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={15}/></div><div className="select-wrap"><select aria-label="Filter by priority" value={priorityFilter} onChange={e => {setPriorityFilter(e.target.value);setPage(1);}}><option>All priorities</option>{priorities.map(p => <option key={p}>{p}</option>)}</select><ChevronDown size={15}/></div>{support && view === "queue" && <div className="select-wrap"><select aria-label="Filter by assigned specialist" value={assigneeFilter} onChange={e => {setAssigneeFilter(e.target.value);setPage(1);}}><option value="">All assignments</option><option value="unassigned">Unassigned</option>{assignees.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}</select><ChevronDown size={15}/></div>}</div>
            <div className="ticket-list">{loading ? <div className="empty-state">Loading requests…</div> : visible.length ? visible.map(t => <button className={`ticket-row ${selected === t.id ? "selected" : ""}`} key={t.id} onClick={() => open(t)}><div className="ticket-symbol"><TicketIcon size={20}/></div><div className="ticket-main"><div className="ticket-title-line"><strong>{t.title}</strong>{!!t.is_sample && <span className="sample-tag">SAMPLE</span>}</div><span>{t.id} <i>·</i> {t.category} <i>·</i> {view === "queue" ? t.requester_name : t.kind}{t.assignee && <> <i>·</i> Assigned: {assignees.find(a => a.email === t.assignee)?.name || t.assignee}</>}</span></div><div className="ticket-date">{date(t.created_at)}</div><span className={`priority-pill ${t.priority.toLowerCase()}`}>{t.priority}</span><span className={`status-pill ${t.status.toLowerCase().replace(" ", "-")}`}><b/>{t.status}</span><ArrowUpRight className="row-arrow" size={17}/></button>) : <div className="empty-state"><div className="empty-icon"><ClipboardList size={26}/></div><strong>{total ? "No requests on this page" : "No requests match these filters"}</strong><p>{total ? "Go to another page." : "Try a different search or create a request."}</p>{!total && <button className="primary-button" onClick={() => changeView("new")}>Create a request</button>}</div>}</div>
            {total > pageSize && <div className="pagination-bar"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span><div><button type="button" disabled={loading || page <= 1} onClick={() => {setPage(page - 1);setSelected(null);}}>Previous</button><strong>Page {page} of {Math.ceil(total / pageSize)}</strong><button type="button" disabled={loading || page * pageSize >= total} onClick={() => {setPage(page + 1);setSelected(null);}}>Next</button></div></div>}
          </section>
        </>}
      </div>
      <footer className="app-footer"><span>© {new Date().getFullYear()} Karamoja Women Umbrella Organisation (KAWUO)</span><span className="developer-credit">Systems Developer <b>LOMER Francis Peter</b> <i>·</i> IT-KAWUO</span></footer>
    </main>
    {activeTicket && <><button className="drawer-backdrop" onClick={() => setSelected(null)} aria-label="Close ticket details"/><aside className="drawer" aria-label="Ticket details"><div className="drawer-head"><div><span className="eyebrow">TICKET DETAILS</span><h2>{activeTicket.id}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close ticket details"><X size={21}/></button></div><div className="drawer-body"><div className="drawer-badges"><span className={`status-pill ${activeTicket.status.toLowerCase().replace(" ", "-")}`}><b/>{activeTicket.status}</span><span className={`priority-pill ${activeTicket.priority.toLowerCase()}`}>{activeTicket.priority}</span>{!!activeTicket.is_sample && <span className="sample-tag">SAMPLE</span>}</div><h3>{activeTicket.title}</h3><p className="drawer-desc">{activeTicket.description}</p><div className="detail-grid"><div><small>REQUESTER</small><strong>{activeTicket.requester_name}</strong></div><div><small>REQUEST TYPE</small><strong>{activeTicket.kind}</strong></div><div><small>CATEGORY</small><strong>{activeTicket.category}</strong></div><div><small>LOCATION</small><strong>{activeTicket.location || "Not specified"}</strong></div><div><small>SUBMITTED</small><strong>{date(activeTicket.created_at)}</strong></div><div><small>LAST UPDATED</small><strong>{date(activeTicket.updated_at)}</strong></div></div>{activeTicket.resolution_notes && <div className="resolution-box"><strong>Support notes</strong><p>{activeTicket.resolution_notes}</p></div>}
      <TicketFeedback key={activeTicket.id} ticketId={activeTicket.id} onUpdated={status => { void load(); setSelected(null); setNotice(status === "Reopened" ? `${activeTicket.id} reopened for IT follow-up. Your feedback is recorded.` : `Thank you. ${activeTicket.id} was confirmed resolved.`); }}/>
      {support && <form className="support-edit" onSubmit={update}><h4>Manage ticket</h4><div className="form-grid"><label>Status<select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Priority<select value={edit.priority} onChange={e => setEdit({ ...edit, priority: e.target.value })}>{priorities.map(p => <option key={p}>{p}</option>)}</select></label></div><label className="full-field">Category<select value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="full-field">Assigned specialist<select value={edit.assignee} onChange={e => setEdit({ ...edit, assignee: e.target.value })}><option value="">Unassigned</option>{edit.assignee && !assignees.some(a => a.email === edit.assignee) && <option value={edit.assignee}>{edit.assignee} (previous assignment)</option>}{assignees.map(a => <option key={a.email} value={a.email}>{a.name} · {a.role}</option>)}</select></label><label className="full-field">Resolution / progress notes<textarea rows={4} maxLength={3000} placeholder="Record what was done or what is pending..." value={edit.resolutionNotes} onChange={e => setEdit({ ...edit, resolutionNotes: e.target.value })}/><small>Required when setting the status to Resolved.</small></label><button className="primary-button save-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></form>}
      </div></aside></>}
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><div>{icon}</div></div><strong>{value}</strong><span className="metric-foot">Current service desk</span></div>; }
