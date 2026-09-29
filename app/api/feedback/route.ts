import { database, getActor, reply, value } from "../../../lib/access";
export const runtime = "edge";

type TicketRow = { id:string; requester_id:string; requester_email:string; requester_name:string; status:string; resolved_at:string|null; is_sample:number };
type FeedbackRow = { id:string; ticket_id:string; requester_name:string; resolution_at:string; satisfied:number; comment:string; created_at:string };

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error:"Sign in to view feedback." }, 401);
    if (actor.status !== "active") return reply({ error:"An active account is required." }, 403);
    const ticketId = value(new URL(request.url).searchParams.get("ticketId"), 64);
    if (!ticketId) return reply({ error:"Select a ticket." }, 400);
    const ticket = await database().prepare("SELECT id, requester_id, requester_email, requester_name, status, resolved_at, is_sample FROM tickets WHERE id = ?").bind(ticketId).first<TicketRow>();
    if (!ticket) return reply({ error:"Ticket not found." }, 404);
    const requester = ticket.requester_id === actor.id || ticket.requester_email === actor.email;
    if (!actor.support && !requester) return reply({ error:"You cannot view this ticket's feedback." }, 403);
    const rows = await database().prepare("SELECT id, ticket_id, requester_name, resolution_at, satisfied, comment, created_at FROM ticket_feedback WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 30").bind(ticketId).all<FeedbackRow>();
    const canRespond = requester && !ticket.is_sample && ticket.status === "Resolved" && Boolean(ticket.resolved_at) && !rows.results.some(row => row.resolution_at === ticket.resolved_at);
    return reply({ feedback:rows.results, canRespond });
  } catch (error) { console.error("Feedback load failed", error); return reply({ error:"Feedback is temporarily unavailable." }, 503); }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error:"Sign in to confirm the resolution." }, 401);
    if (actor.status !== "active") return reply({ error:"An active account is required." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const ticketId = value(body.ticketId, 64), comment = value(body.comment, 1500);
    if (!ticketId || typeof body.satisfied !== "boolean" || (!body.satisfied && comment.length < 10))
      return reply({ error:"Choose whether the issue is resolved. If it is not, describe what still needs attention." }, 400);
    const ticket = await database().prepare("SELECT id, requester_id, requester_email, requester_name, status, resolved_at, is_sample FROM tickets WHERE id = ?").bind(ticketId).first<TicketRow>();
    if (!ticket) return reply({ error:"Ticket not found." }, 404);
    if (ticket.requester_id !== actor.id && ticket.requester_email !== actor.email) return reply({ error:"Only the requester can confirm this resolution." }, 403);
    if (ticket.is_sample || ticket.status !== "Resolved" || !ticket.resolved_at) return reply({ error:"This ticket is not awaiting resolution feedback." }, 409);
    const now = new Date().toISOString();
    const insert = database().prepare(`INSERT INTO ticket_feedback
      (id, ticket_id, requester_email, requester_name, resolution_at, satisfied, comment, created_at)
      SELECT ?, id, ?, ?, resolved_at, ?, ?, ? FROM tickets
      WHERE id = ? AND requester_email = ? AND status = 'Resolved' AND resolved_at = ?`)
      .bind(crypto.randomUUID(), actor.email, actor.name, body.satisfied ? 1 : 0, comment, now, ticketId, actor.email, ticket.resolved_at);
    try {
      const results = body.satisfied
        ? await database().batch([insert])
        : await database().batch([insert, database().prepare(`UPDATE tickets SET status = 'Reopened', resolved_at = NULL, updated_at = ?
            WHERE id = ? AND status = 'Resolved' AND resolved_at = ?`).bind(now, ticketId, ticket.resolved_at)]);
      if (!results[0].meta.changes) return reply({ error:"The ticket changed. Refresh and try again." }, 409);
      return reply({ ticketId, status:body.satisfied ? "Resolved" : "Reopened" }, 201);
    } catch (error) {
      if (String(error).includes("UNIQUE") || String(error).includes("constraint")) return reply({ error:"Feedback was already submitted for this resolution." }, 409);
      throw error;
    }
  } catch (error) { console.error("Feedback submission failed", error); return reply({ error:"Feedback could not be saved. Please try again." }, 503); }
}
