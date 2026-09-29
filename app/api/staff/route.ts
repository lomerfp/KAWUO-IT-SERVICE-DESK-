import { database, getActor, normalizeEmail, reply, STAFF_ROLES, valid, value } from "../../../lib/access";
import { TECHNICAL_ROLES } from "../../../lib/roles";
import { env } from "cloudflare:workers";
export const runtime = "edge";
type Staff = { email: string; name: string; department: string; role: string; active: number; self_requested: number; created_at: string; updated_at: string };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to continue." }, 401);
    if (actor.status !== "active") return reply({ error: "An active staff account is required." }, 403);
    const assigneesOnly = new URL(request.url).searchParams.get("assignees") === "1";
    if (assigneesOnly && !actor.support) return reply({ error: "IT support access is required." }, 403);
    const rows = assigneesOnly
      ? await database().prepare(`SELECT * FROM staff_members WHERE active = 1 AND role IN (${TECHNICAL_ROLES.map(() => "?").join(",")}) ORDER BY name COLLATE NOCASE ASC LIMIT 1000`).bind(...TECHNICAL_ROLES).all<Staff>()
      : actor.admin
        ? await database().prepare("SELECT * FROM staff_members ORDER BY active ASC, name COLLATE NOCASE ASC LIMIT 1000").all<Staff>()
        : await database().prepare("SELECT * FROM staff_members WHERE active = 1 ORDER BY name COLLATE NOCASE ASC LIMIT 1000").all<Staff>();
    const owner = { email: env.IT_SUPPORT_EMAIL?.toLowerCase() || "", name: "IT Systems Administrator", department: "IT", role: "Systems Administrator", active: 1, self_requested: 0, created_at: "", updated_at: "" };
    if (actor.admin) { owner.email = actor.email; owner.name = actor.name; }
    return reply({ staff: [owner, ...rows.results.filter(s => s.email !== owner.email)], roles: [...STAFF_ROLES, "Systems Administrator"] });
  } catch (error) { console.error("Staff load failed", error); return reply({ error: "The staff directory is temporarily unavailable." }, 503); }
}
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to continue." }, 401);
    if (!actor.admin) return reply({ error: "Systems Administrator access is required." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(value(body.email, 254)), name = value(body.name, 100), department = value(body.department, 100);
    const role = body.role;
    if (!emailPattern.test(email) || name.length < 2 || !valid(role, STAFF_ROLES)) return reply({ error: "Enter a valid email, name and staff role." }, 400);
    if (email === actor.email) return reply({ error: "The Systems Administrator role is managed separately." }, 400);
    const now = new Date().toISOString();
    await database().prepare(`INSERT INTO staff_members (email, name, department, role, active, self_requested, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 0, ?, ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name, department = excluded.department, role = excluded.role, active = 1, self_requested = 0, updated_at = excluded.updated_at`)
      .bind(email, name, department, role, now, now).run();
    return reply({ email }, 201);
  } catch (error) { console.error("Staff create failed", error); return reply({ error: "The staff account could not be saved." }, 503); }
}
export async function PATCH(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to continue." }, 401);
    if (!actor.admin) return reply({ error: "Systems Administrator access is required." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(value(body.email, 254)), role = body.role;
    if (!emailPattern.test(email) || email === actor.email || !valid(role, STAFF_ROLES) || typeof body.active !== "boolean") return reply({ error: "Select a valid staff member, role and account status." }, 400);
    const result = await database().prepare("UPDATE staff_members SET role = ?, active = ?, self_requested = 0, updated_at = ? WHERE email = ?")
      .bind(role, body.active ? 1 : 0, new Date().toISOString(), email).run();
    if (!result.meta.changes) return reply({ error: "Staff account not found." }, 404);
    return reply({ email });
  } catch (error) { console.error("Staff update failed", error); return reply({ error: "The staff account could not be updated." }, 503); }
}
