import { database, getActor, normalizeEmail, reply, STAFF_ROLES, valid, value } from "../../../lib/access";
export const runtime = "edge";
export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to continue." }, 401);
    return reply({ account: actor, roles: [...STAFF_ROLES, "Systems Administrator"] });
  } catch (error) { console.error("Account load failed", error); return reply({ error: "Account information is temporarily unavailable." }, 503); }
}
export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor) return reply({ error: "Sign in to create a profile." }, 401);
    if (actor.admin || actor.status === "active") return reply({ error: "This account is already active." }, 409);
    if (actor.status === "disabled") return reply({ error: "This account has been disabled. Contact IT support." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const name = value(body.name, 100), department = value(body.department, 100);
    const requestedRole = valid(body.role, STAFF_ROLES) ? String(body.role) : "Staff";
    if (name.length < 2 || department.length < 2) return reply({ error: "Enter your name and department." }, 400);
    const now = new Date().toISOString();
    await database().prepare(`INSERT INTO staff_members (email, name, department, role, active, self_requested, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 1, ?, ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name, department = excluded.department, role = excluded.role, updated_at = excluded.updated_at
      WHERE staff_members.active = 0 AND staff_members.self_requested = 1`)
      .bind(normalizeEmail(actor.email), name, department, requestedRole, now, now).run();
    return reply({ status: "pending", message: "Your profile request is awaiting IT approval." }, 201);
  } catch (error) { console.error("Account request failed", error); return reply({ error: "The profile request could not be saved." }, 503); }
}
