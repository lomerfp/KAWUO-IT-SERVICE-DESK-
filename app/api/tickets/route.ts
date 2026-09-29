import { database, getActor, reply, valid, value } from "../../../lib/access";
import { TECHNICAL_ROLES } from "../../../lib/roles";
import { env } from "cloudflare:workers";
export const runtime = "edge";

type Ticket = {
  id: string; requester_id: string; requester_name: string; requester_email: string;
  kind: string; category: string; priority: string; title: string; description: string;
  location: string; status: string; assignee: string; resolution_notes: string;
  created_at: string; updated_at: string; resolved_at: string | null; is_sample: number;
};
const kinds = ["Incident", "Service request"];
const categories = ["Hardware", "Software", "Network & internet", "Email & accounts", "Printer", "QuickBooks", "Data & M&E", "Security & access", "Website", "Other"];
const priorities = ["Low", "Medium", "High", "Urgent"];
const statuses = ["New", "In progress", "Waiting", "Reopened", "Resolved"];

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to view tickets." }, 401);
    if (actor.status !== "active") return reply({ error: "Your staff profile is not active." }, 403);
    const params = new URL(request.url).searchParams;
    const scope = actor.support && params.get("view") !== "mine" ? "queue" : "mine";
    const page = Math.min(100000, Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1));
    const pageSize = 25;
    const status = params.get("status") || "";
    const category = params.get("category") || "";
    const priority = params.get("priority") || "";
    if ((status && !valid(status, statuses)) || (category && !valid(category, categories)) || (priority && !valid(priority, priorities))) return reply({ error: "Invalid ticket filter." }, 400);
    const scopeSql = scope === "mine" ? "WHERE (requester_id = ? OR requester_email = ?)" : "";
    const scopeArgs = scope === "mine" ? [actor.id, actor.email] : [];
    const summary = await database().prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status != 'Resolved' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN priority = 'Urgent' AND status != 'Resolved' THEN 1 ELSE 0 END) AS urgent,
      SUM(CASE WHEN is_sample = 1 THEN 1 ELSE 0 END) AS sample_count
      FROM tickets ${scopeSql}`).bind(...scopeArgs).first<Record<string, number>>();
    const where = scopeSql ? [scopeSql.slice(6)] : [];
    const args: (string | number)[] = [...scopeArgs];
    if (status) { where.push("status = ?"); args.push(status); }
    if (category) { where.push("category = ?"); args.push(category); }
    if (priority) { where.push("priority = ?"); args.push(priority); }
    const assigneeFilter = params.get("assignee") || "";
    if (scope === "queue" && assigneeFilter) {
      if (assigneeFilter === "unassigned") where.push("assignee = ''");
      else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assigneeFilter) && assigneeFilter.length <= 254) { where.push("assignee = ?"); args.push(assigneeFilter.toLowerCase()); }
      else return reply({ error: "Invalid assignment filter." }, 400);
    }
    const q = value(params.get("q"), 100).toLowerCase();
    if (q) {
      where.push("(LOWER(id) LIKE ? OR LOWER(title) LIKE ? OR LOWER(requester_name) LIKE ? OR LOWER(assignee) LIKE ?)");
      args.push(...Array(4).fill(`%${q}%`));
    }
    const filterSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const totalRow = await database().prepare(`SELECT COUNT(*) AS total FROM tickets ${filterSql}`).bind(...args).first<{ total: number }>();
    const total = totalRow?.total || 0;
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const result = await database().prepare(`SELECT * FROM tickets ${filterSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...args, pageSize, (currentPage - 1) * pageSize).all<Ticket>();
    const [byStatus, byPriority] = await Promise.all([
      database().prepare(`SELECT status AS key, COUNT(*) AS total FROM tickets ${scopeSql} GROUP BY status`).bind(...scopeArgs).all<{ key: string; total: number }>(),
      database().prepare(`SELECT priority AS key, COUNT(*) AS total FROM tickets ${scopeSql} GROUP BY priority`).bind(...scopeArgs).all<{ key: string; total: number }>(),
    ]);
    return reply({ tickets: result.results, total, page: currentPage, pageSize,
      metrics: { total: summary?.total || 0, open: summary?.open || 0, new: summary?.new_count || 0,
        resolved: summary?.resolved || 0, urgent: summary?.urgent || 0, sampleCount: summary?.sample_count || 0,
        byStatus: Object.fromEntries(byStatus.results.map(x => [x.key, x.total])),
        byPriority: Object.fromEntries(byPriority.results.map(x => [x.key, x.total])) },
      support: actor.support, user: { name: actor.name, email: actor.email, role: actor.role } });
  } catch (error) { console.error("Ticket load failed", error); return reply({ error: "Tickets are temporarily unavailable. Please try again." }, 503); }
}
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to submit a request." }, 401);
    if (actor.status !== "active") return reply({ error: "Your staff profile must be approved first." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const title = value(body.title, 120), description = value(body.description, 3000), location = value(body.location, 120);
    if (title.length < 5 || description.length < 10 || !valid(body.kind, kinds) || !valid(body.category, categories) || !valid(body.priority, priorities))
      return reply({ error: "Complete the title, description, type, category and priority." }, 400);
    const id = `KAW-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    await database().prepare(`INSERT INTO tickets (id, requester_id, requester_name, requester_email, kind, category, priority, title, description, location, status, assignee, resolution_notes, created_at, updated_at, resolved_at, is_sample)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', '', '', ?, ?, NULL, 0)`)
      .bind(id, actor.id, actor.name, actor.email, body.kind, body.category, body.priority, title, description, location, now, now).run();
    return reply({ id }, 201);
  } catch (error) { console.error("Ticket creation failed", error); return reply({ error: "The request could not be saved. Please try again." }, 503); }
}
export async function PATCH(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to update tickets." }, 401);
    if (!actor.support) return reply({ error: "IT support access is required." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const id = value(body.id, 64), rawAssignee = value(body.assignee, 254), assignee = rawAssignee.includes("@") ? rawAssignee.toLowerCase() : rawAssignee, notes = value(body.resolutionNotes, 3000);
    if (!id || !valid(body.status, statuses) || !valid(body.priority, priorities) || !valid(body.category, categories)) return reply({ error: "Select a valid status, priority and category." }, 400);
    if (body.status === "Resolved" && !notes) return reply({ error: "Add resolution notes before resolving a ticket." }, 400);
    const existing = await database().prepare("SELECT id, assignee FROM tickets WHERE id = ?").bind(id).first<{ id: string; assignee: string }>();
    if (!existing) return reply({ error: "Ticket not found." }, 404);
    if (assignee && assignee !== existing.assignee && assignee !== env.IT_SUPPORT_EMAIL?.toLowerCase()) {
      const member = await database().prepare("SELECT role FROM staff_members WHERE email = ? AND active = 1").bind(assignee.toLowerCase()).first<{ role: string }>();
      if (!member || !TECHNICAL_ROLES.includes(member.role)) return reply({ error: "Assign tickets to an active IT specialist." }, 400);
    }
    const now = new Date().toISOString();
    await database().prepare("UPDATE tickets SET status = ?, priority = ?, category = ?, assignee = ?, resolution_notes = ?, updated_at = ?, resolved_at = ? WHERE id = ?")
      .bind(body.status, body.priority, body.category, assignee, notes, now, body.status === "Resolved" ? now : null, id).run();
    return reply({ id });
  } catch (error) { console.error("Ticket update failed", error); return reply({ error: "The update could not be saved. Please try again." }, 503); }
}
