import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull().default(""),
  status: text("status").notNull().default("New"),
  assignee: text("assignee").notNull().default(""),
  resolutionNotes: text("resolution_notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  resolvedAt: text("resolved_at"),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  index("idx_tickets_requester_created").on(table.requesterId, table.createdAt),
  index("idx_tickets_status_created").on(table.status, table.createdAt),
  index("idx_tickets_created").on(table.createdAt),
  index("idx_tickets_assignee_created").on(table.assignee, table.createdAt),
  index("idx_tickets_category_created").on(table.category, table.createdAt),
  index("idx_tickets_priority_created").on(table.priority, table.createdAt),
]);

export const staffMembers = sqliteTable("staff_members", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull().default(""),
  role: text("role").notNull().default("Staff"),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  selfRequested: integer("self_requested", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_staff_members_active_role").on(table.active, table.role)]);

export const ticketFeedback = sqliteTable("ticket_feedback", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull(),
  requesterEmail: text("requester_email").notNull(),
  requesterName: text("requester_name").notNull(),
  resolutionAt: text("resolution_at").notNull(),
  satisfied: integer("satisfied", { mode: "boolean" }).notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_ticket_feedback_resolution").on(table.ticketId, table.resolutionAt),
  index("idx_ticket_feedback_created").on(table.createdAt),
]);

export const remoteSessions = sqliteTable("remote_sessions", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  requesterEmail: text("requester_email").notNull(),
  requesterName: text("requester_name").notNull(),
  device: text("device").notNull(),
  issue: text("issue").notNull(),
  ticketId: text("ticket_id"),
  status: text("status").notNull().default("Requested"),
  assignee: text("assignee").notNull().default(""),
  notes: text("notes").notNull().default(""),
  consentAcknowledged: integer("consent_acknowledged", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_remote_sessions_requester_created").on(table.requesterId, table.createdAt),
  index("idx_remote_sessions_status_created").on(table.status, table.createdAt),
]);
