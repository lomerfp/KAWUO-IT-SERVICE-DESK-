import type { D1Database } from "@cloudflare/workers-types";

// Staff profiles supplied by KAWUO. Portal access is also gated by the Site's
// private email allowlist, which is managed separately from these records.
const initialStaff = [
  ["todelok@kawuo.org", "Thomas Odelok", "Executive Office", "Manager"],
  ["cdorothy@kawuo.org", "Chegem Dorothy", "WEE", "Programme Officer"],
  ["aramathan@kawuo.org", "Abdi Ramathan", "MEAL", "Staff"],
  ["kbetty@kawuo.org", "Kapchesiy Betty", "WAJ", "Programme Officer"],
  ["nregina@kawuo.org", "Nangiro Regina", "Nakapiripirit Project", "Programme Officer"],
  ["amark@kawuo.org", "Angella Mark", "Kaabong Project", "Programme Officer"],
  ["ajennifer@kawuo.org", "Abura Jennifer", "Procurement / Supply Chain", "Staff"],
  ["astella@kawuo.org", "Aguti Stella", "Moroto Project", "Programme Officer"],
  ["glokut@kawuo.org", "Okello Godfrey Lokut", "MEAL", "Staff"],
  ["bbernard@kawuo.org", "Kibalya Bernard", "MEAL", "Staff"],
] as const;

export async function ensureInitialStaff(db: D1Database) {
  const existing = await db.prepare(
    `SELECT COUNT(*) AS total FROM staff_members WHERE email IN (${initialStaff.map(() => "?").join(",")})`
  ).bind(...initialStaff.map(([email]) => email)).first<{ total: number }>();
  if (existing?.total === initialStaff.length) return;

  const now = new Date().toISOString();
  await db.batch(initialStaff.map(([email, name, department, role]) =>
    db.prepare(`INSERT OR IGNORE INTO staff_members
      (email, name, department, role, active, self_requested, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 0, ?, ?)`)
      .bind(email, name, department, role, now, now)
  ));
}
