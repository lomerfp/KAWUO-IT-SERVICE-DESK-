import { database, getActor, reply, valid, value } from "../../../lib/access";
export const runtime = "edge";
type Session = { id: string; requester_id: string; requester_email: string; requester_name: string; device: string; issue: string; ticket_id: string | null; status: string; assignee: string; notes: string; consent_acknowledged: number; created_at: string; updated_at: string };
const statuses = ["Requested", "Scheduled", "In session", "Completed", "Cancelled"];
export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to view remote assistance." }, 401);
    if (actor.status !== "active") return reply({ error: "Your staff profile is not active." }, 403);
    const result = actor.support
      ? await database().prepare("SELECT * FROM remote_sessions ORDER BY created_at DESC LIMIT 500").all<Session>()
      : await database().prepare("SELECT * FROM remote_sessions WHERE requester_id = ? ORDER BY created_at DESC LIMIT 200").bind(actor.id).all<Session>();
    return reply({ sessions: result.results, support: actor.support });
  } catch (error) { console.error("Remote session load failed", error); return reply({ error: "Remote requests are temporarily unavailable." }, 503); }
}
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to request assistance." }, 401);
    if (actor.status !== "active") return reply({ error: "Your staff profile must be approved first." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const device = value(body.device, 120), issue = value(body.issue, 2000), ticketId = value(body.ticketId, 64);
    if (device.length < 3 || issue.length < 10 || body.consent !== true) return reply({ error: "Describe the device and issue, then acknowledge the consent step." }, 400);
    if (ticketId) {
      const ticket = await database().prepare("SELECT requester_id FROM tickets WHERE id = ? AND is_sample = 0").bind(ticketId).first<{requester_id: string}>();
      if (!ticket || (!actor.support && ticket.requester_id !== actor.id)) return reply({ error: "Select one of your own tickets." }, 400);
    }
    const id = `RA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, now = new Date().toISOString();
    await database().prepare(`INSERT INTO remote_sessions (id, requester_id, requester_email, requester_name, device, issue, ticket_id, status, assignee, notes, consent_acknowledged, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Requested', '', '', 1, ?, ?)`)
      .bind(id, actor.id, actor.email, actor.name, device, issue, ticketId || null, now, now).run();
    return reply({ id }, 201);
  } catch (error) { console.error("Remote session create failed", error); return reply({ error: "The remote assistance request could not be saved." }, 503); }
}
export async function PATCH(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to update assistance." }, 401);
    if (actor.status !== "active") return reply({ error: "Your staff profile is not active." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const id = value(body.id, 64), status = body.status;
    if (!id || !valid(status, statuses)) return reply({ error: "Select a valid request and status." }, 400);
    const existing = await database().prepare("SELECT requester_id, status FROM remote_sessions WHERE id = ?").bind(id).first<{requester_id: string; status: string}>();
    if (!existing) return reply({ error: "Assistance request not found." }, 404);
    if (existing.status === "Cancelled" && status !== "Cancelled") return reply({ error: "A cancelled request needs a new consent-based request." }, 409);
    if (existing.status === "Completed" && status === "Cancelled") return reply({ error: "A completed session cannot be cancelled." }, 409);
    if (!actor.support) {
      if (existing.requester_id !== actor.id || status !== "Cancelled") return reply({ error: "You may only cancel your own request." }, 403);
      await database().prepare("UPDATE remote_sessions SET status = 'Cancelled', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
      return reply({ id });
    }
    const assignee = value(body.assignee, 100), notes = value(body.notes, 2000);
    if (status === "Completed" && !notes) return reply({ error: "Add outcome notes before completing remote assistance." }, 400);
    await database().prepare("UPDATE remote_sessions SET status = ?, assignee = ?, notes = ?, updated_at = ? WHERE id = ?")
      .bind(status, assignee, notes, new Date().toISOString(), id).run();
    return reply({ id });
  } catch (error) { console.error("Remote session update failed", error); return reply({ error: "The assistance request could not be updated." }, 503); }
}
