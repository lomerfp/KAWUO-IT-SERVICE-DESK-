"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquareText, RotateCcw } from "lucide-react";

type Feedback = { id:string; requester_name:string; satisfied:number; comment:string; created_at:string };
export default function TicketFeedback({ ticketId, onUpdated }: { ticketId:string; onUpdated:(status:string)=>void }) {
  const [feedback, setFeedback] = useState<Feedback[]>([]), [canRespond, setCanRespond] = useState(false);
  const [satisfied, setSatisfied] = useState<boolean|null>(null), [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void fetch(`/api/feedback?ticketId=${encodeURIComponent(ticketId)}`, {cache:"no-store"})
      .then(async r => { const d = await r.json() as {feedback?:Feedback[];canRespond?:boolean;error?:string}; if (!r.ok) throw new Error(d.error || "Could not load feedback."); return d; })
      .then(d => { if (live) { setFeedback(d.feedback || []); setCanRespond(Boolean(d.canRespond)); setError(""); } })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : "Could not load feedback."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [ticketId]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (satisfied === null) return;
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/feedback", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ticketId,satisfied,comment})});
      const d = await r.json() as {status?:string;error?:string};
      if (!r.ok) throw new Error(d.error || "Could not save feedback.");
      onUpdated(d.status || "Resolved");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save feedback."); }
    finally { setSaving(false); }
  }
  return <section className="feedback-panel"><div className="feedback-title"><MessageSquareText size={19}/><h4>Requester feedback</h4></div>
    {loading ? <p>Loading feedback…</p> : <>
      {feedback.length ? <div className="feedback-history">{feedback.map(item => <div className="feedback-entry" key={item.id}><span className={item.satisfied ? "feedback-positive" : "feedback-negative"}>{item.satisfied ? <><CheckCircle2 size={14}/> Confirmed resolved</> : <><RotateCcw size={14}/> Not resolved · reopened</>}</span><p>{item.comment || "The requester confirmed the fix worked."}</p><small>{item.requester_name} · {new Date(item.created_at).toLocaleDateString("en-UG")}</small></div>)}</div> : <p className="feedback-empty">No feedback yet.</p>}
      {canRespond && <form onSubmit={send} className="feedback-form"><strong>Did this fix your issue?</strong><p>Your response goes to IT and appears in management reporting.</p><div className="feedback-choice"><label className={satisfied === true ? "selected" : ""}><input type="radio" name="satisfied" checked={satisfied === true} onChange={() => setSatisfied(true)}/> Yes, resolved</label><label className={satisfied === false ? "selected" : ""}><input type="radio" name="satisfied" checked={satisfied === false} onChange={() => setSatisfied(false)}/> No, still needs work</label></div><label>Comment {satisfied === false ? "(required)" : "(optional)"}<textarea rows={3} maxLength={1500} minLength={satisfied === false ? 10 : undefined} required={satisfied === false} placeholder={satisfied === false ? "Describe what is still not working…" : "What went well, or what could improve?"} value={comment} onChange={e => setComment(e.target.value)}/></label><button type="submit" className="primary-button" disabled={saving || satisfied === null}>{saving ? "Sending…" : "Send feedback"}</button></form>}
    </>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}
