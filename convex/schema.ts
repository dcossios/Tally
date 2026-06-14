import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  transactions: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("expense"), v.literal("income")),
    status: v.union(v.literal("confirmed"), v.literal("pending")),
    currency: v.union(v.literal("COP"), v.literal("USD")),
    amountMinor: v.number(),
    amountCopMinor: v.optional(v.number()),
    merchant: v.string(),
    categoryId: v.optional(v.id("categories")),
    categoryName: v.string(),
    occurredAt: v.number(),
    source: v.union(v.literal("manual"), v.literal("sms")),
    smsImportId: v.optional(v.id("smsImports")),
    accountLabel: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_userId_and_occurredAt", ["userId", "occurredAt"])
    .index("by_userId_and_status_and_occurredAt", [
      "userId",
      "status",
      "occurredAt",
    ])
    .index("by_userId_and_categoryId_and_occurredAt", [
      "userId",
      "categoryId",
      "occurredAt",
    ]),
  smsImports: defineTable({
    userId: v.id("users"),
    sender: v.string(),
    rawMessage: v.string(),
    normalizedHash: v.string(),
    receivedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("discarded"),
    ),
    parserRule: v.string(),
    transactionId: v.optional(v.id("transactions")),
    error: v.optional(v.string()),
  })
    .index("by_userId_and_normalizedHash", ["userId", "normalizedHash"])
    .index("by_userId_and_status_and_receivedAt", [
      "userId",
      "status",
      "receivedAt",
    ]),
  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    kind: v.union(v.literal("expense"), v.literal("income")),
    icon: v.string(),
    color: v.string(),
    isDefault: v.boolean(),
  })
    .index("by_userId_and_kind_and_name", ["userId", "kind", "name"])
    .index("by_userId_and_name", ["userId", "name"]),
  shortcutTokens: defineTable({
    userId: v.id("users"),
    name: v.string(),
    tokenHash: v.string(),
    prefix: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),
});
