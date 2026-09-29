import { database, getActor, reply } from "../../../lib/access";
export const runtime = "edge";

type ReportTicket = { id:string; title:string; category:string; priority:string; status:string; assignee:string; requester_name:string; created_at:string; resolved_at:string|null };
type CountRow = { key:string; total:number };
const csvCell = (v: unknown) => {
  const value = String(v ?? "");
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to view reports." }, 401);
    if (!actor.reports) return reply({ error: "Management or IT reporting access is required." }, 403);
    const params = new URL(request.url).searchParams;
    const month = params.get("month") || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return reply({ error: "Choose a valid month." }, 400);
    const [year, m] = month.split("-").map(Number);
    const start = `${month}-01T00:00:00.000Z`;
    const end = new Date(Date.UTC(year, m, 1)).toISOString();
    if (params.get("format") === "csv") {
      let last: { created_at:string; id:string } | null = null;
      let finished = false;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (finished) { controller.close(); return; }
          const cursor = last as { created_at:string; id:string } | null;
          const sql = `SELECT id, title, requester_name, category, priority, status, assignee, created_at, resolved_at
            FROM tickets WHERE is_sample = 0 AND created_at >= ? AND created_at < ?
            ${cursor ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : ""}
            ORDER BY created_at DESC, id DESC LIMIT 500`;
          const args = cursor ? [start, end, cursor.created_at, cursor.created_at, cursor.id] : [start, end];
          const rows = (await database().prepare(sql).bind(...args).all<ReportTicket>()).results;
          if (!cursor) controller.enqueue(encoder.encode("\uFEFFTicket ID,Title,Requester,Category,Priority,Status,Assigned to,Submitted,Resolved\r\n"));
          if (rows.length) {
            controller.enqueue(encoder.encode(rows.map(t => [t.id,t.title,t.requester_name,t.category,t.priority,t.status,t.assignee,t.created_at,t.resolved_at].map(csvCell).join(",")).join("\r\n") + "\r\n"));
            const tail = rows[rows.length-1]; last = { created_at:tail.created_at, id:tail.id };
          }
          if (rows.length < 500) finished = true;
        }
      });
      return new Response(stream, { headers:{ "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":`attachment; filename="KAWUO-IT-Report-${month}.csv"`, "Cache-Control":"no-store" } });
    }
    const [submittedRow, resolvedRow, backlogRow, categoryRows, priorityRows, detailRows, feedbackRow, feedbackRows] = await Promise.all([
      database().prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) AS urgent FROM tickets WHERE is_sample = 0 AND created_at >= ? AND created_at < ?`).bind(start,end).first<{total:number;urgent:number}>(),
      database().prepare(`SELECT COUNT(*) AS total, AVG((julianday(resolved_at) - julianday(created_at)) * 24) AS average_hours FROM tickets WHERE is_sample = 0 AND resolved_at >= ? AND resolved_at < ?`).bind(start,end).first<{total:number;average_hours:number|null}>(),
      database().prepare(`SELECT COUNT(*) AS total FROM tickets WHERE is_sample = 0 AND created_at < ? AND (resolved_at IS NULL OR resolved_at >= ?)`).bind(end,end).first<{total:number}>(),
      database().prepare(`SELECT category AS key, COUNT(*) AS total FROM tickets WHERE is_sample = 0 AND created_at >= ? AND created_at < ? GROUP BY category ORDER BY total DESC`).bind(start,end).all<CountRow>(),
      database().prepare(`SELECT priority AS key, COUNT(*) AS total FROM tickets WHERE is_sample = 0 AND created_at >= ? AND created_at < ? GROUP BY priority ORDER BY total DESC`).bind(start,end).all<CountRow>(),
      database().prepare(`SELECT id, title, category, priority, status, assignee, requester_name, created_at, resolved_at FROM tickets WHERE is_sample = 0 AND created_at >= ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT 100`).bind(start,end).all<ReportTicket>(),
      database().prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN satisfied = 1 THEN 1 ELSE 0 END) AS satisfied,
        SUM(CASE WHEN satisfied = 0 THEN 1 ELSE 0 END) AS unresolved
        FROM ticket_feedback WHERE created_at >= ? AND created_at < ?`).bind(start,end).first<{total:number;satisfied:number;unresolved:number}>(),
      database().prepare(`SELECT f.ticket_id, f.requester_name, f.satisfied, f.comment, f.created_at, t.title
        FROM ticket_feedback f JOIN tickets t ON t.id = f.ticket_id
        WHERE f.created_at >= ? AND f.created_at < ? ORDER BY f.created_at DESC LIMIT 20`)
        .bind(start,end).all<{ticket_id:string;requester_name:string;satisfied:number;comment:string;created_at:string;title:string}>(),
    ]);
    return reply({ month, generatedAt:new Date().toISOString(), summary:{ submitted:submittedRow?.total || 0, resolved:resolvedRow?.total || 0,
      backlog:backlogRow?.total || 0, urgent:submittedRow?.urgent || 0,
      averageResolutionHours:resolvedRow?.average_hours == null ? null : Math.round(resolvedRow.average_hours * 10) / 10 },
      categoryCounts:categoryRows.results.map(x => [x.key,x.total]), priorityCounts:priorityRows.results.map(x => [x.key,x.total]),
      feedbackSummary:{ total:feedbackRow?.total || 0, satisfied:feedbackRow?.satisfied || 0, unresolved:feedbackRow?.unresolved || 0 },
      feedbackComments:feedbackRows.results, tickets:detailRows.results, hasMore:(submittedRow?.total || 0) > detailRows.results.length });
  } catch (error) { console.error("Monthly report failed", error); return reply({ error: "The monthly report is temporarily unavailable." }, 503); }
}
