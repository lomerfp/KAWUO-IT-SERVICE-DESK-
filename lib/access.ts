import { env } from "cloudflare:workers";
import { ensureInitialStaff } from "./staff-seed";
import { REPORT_ROLES, STAFF_ROLES, TECHNICAL_ROLES } from "./roles";

export { STAFF_ROLES } from "./roles";
export type StaffRole = (typeof STAFF_ROLES)[number] | "Systems Administrator";
export type Actor = {
  id: string; email: string; name: string; department: string; role: StaffRole;
  status: "active" | "pending" | "disabled" | "unregistered";
  admin: boolean; support: boolean; reports: boolean;
};

type MemberRow = { name: string; department: string; role: StaffRole; active: number; self_requested: number };
export function database() { if (!env.DB) throw new Error("Service database unavailable"); return env.DB; }
export const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const value = (x: unknown, max = 500) => typeof x === "string" ? x.trim().slice(0, max) : "";
export const valid = (x: unknown, options: readonly string[]) => typeof x === "string" && options.includes(x);
export const normalizeEmail = (x: string) => x.trim().toLowerCase();

export async function getActor(request: Request): Promise<Actor | null> {
  const id = request.headers.get("oai-authenticated-user-id");
  const emailHeader = request.headers.get("oai-authenticated-user-email");
  if (!id || !emailHeader) return null;
  await ensureInitialStaff(database());
  const email = normalizeEmail(emailHeader);
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  let displayName = email;
  if (encoded && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { displayName = decodeURIComponent(encoded).slice(0, 100); } catch { /* email fallback */ }
  }
  const admin = Boolean(env.IT_SUPPORT_EMAIL && normalizeEmail(env.IT_SUPPORT_EMAIL) === email);
  if (admin) return { id, email, name: displayName, department: "IT", role: "Systems Administrator", status: "active", admin: true, support: true, reports: true };
  const member = await database().prepare("SELECT name, department, role, active, self_requested FROM staff_members WHERE email = ?").bind(email).first<MemberRow>();
  if (!member) return { id, email, name: displayName, department: "", role: "Staff", status: "unregistered", admin: false, support: false, reports: false };
  const status = member.active ? "active" : member.self_requested ? "pending" : "disabled";
  const role = member.role === "Systems Administrator" ? "Staff" : member.role;
  return { id, email, name: member.name || displayName, department: member.department, role, status, admin: false, support: status === "active" && TECHNICAL_ROLES.includes(role), reports: status === "active" && REPORT_ROLES.includes(role) };
}
