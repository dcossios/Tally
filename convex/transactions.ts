import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const transactionFields = {
  type: v.union(v.literal("expense"), v.literal("income")),
  currency: v.union(v.literal("COP"), v.literal("USD")),
  amountMinor: v.number(),
  amountCopMinor: v.optional(v.number()),
  merchant: v.string(),
  categoryId: v.optional(v.id("categories")),
  categoryName: v.string(),
  occurredAt: v.number(),
  accountLabel: v.optional(v.string()),
  note: v.optional(v.string()),
};

export const dashboard = query({
  args: { monthStart: v.number(), monthEnd: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_userId_and_occurredAt", (q) =>
        q.eq("userId", userId).lt("occurredAt", args.monthEnd),
      )
      .order("desc")
      .take(500);

    let incomeMinor = 0;
    let expenseMinor = 0;
    const confirmed = rows.filter(
      (row) => row.status === "confirmed" && row.amountCopMinor !== undefined,
    );
    for (const row of confirmed) {
      if (row.type === "income") incomeMinor += row.amountCopMinor ?? 0;
      else expenseMinor += row.amountCopMinor ?? 0;
    }

    const pending = await ctx.db
      .query("smsImports")
      .withIndex("by_userId_and_status_and_receivedAt", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .order("desc")
      .take(50);

    return {
      incomeMinor,
      expenseMinor,
      balanceMinor: incomeMinor - expenseMinor,
      pendingCount: pending.length,
      recent: rows.slice(0, 6),
    };
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("transactions")
      .withIndex("by_userId_and_occurredAt", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const create = mutation({
  args: transactionFields,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return ctx.db.insert("transactions", {
      ...args,
      userId,
      status:
        args.currency === "USD" && args.amountCopMinor === undefined
          ? "pending"
          : "confirmed",
      source: "manual",
    });
  },
});

export const update = mutation({
  args: { id: v.id("transactions"), ...transactionFields },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const current = await ctx.db.get("transactions", args.id);
    if (!current || current.userId !== userId) throw new Error("No encontrado.");
    const { id, ...fields } = args;
    await ctx.db.patch("transactions", id, {
      ...fields,
      status:
        fields.currency === "USD" && fields.amountCopMinor === undefined
          ? "pending"
          : "confirmed",
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("transactions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const current = await ctx.db.get("transactions", args.id);
    if (!current || current.userId !== userId) throw new Error("No encontrado.");
    await ctx.db.delete("transactions", args.id);
    return null;
  },
});

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_userId_and_occurredAt", (q) => q.eq("userId", userId))
      .take(1);
    if (existing.length > 0) return false;
    const values = [
      ["expense", "COP", 490000, 490000, "EXQUI SANTA M TA SAL", "Compras", Date.UTC(2026, 5, 13, 16, 49)],
      ["expense", "COP", 520000, 520000, "HOTEL ZUANA BEACH RE", "Vivienda", Date.UTC(2026, 5, 11, 13, 40)],
      ["expense", "USD", 1718, undefined, "HETZNER ONLINE GMBH", "Servicios digitales", Date.UTC(2026, 5, 4, 1, 57)],
      ["income", "COP", 87545200, 87545200, "HERCOSSIOS S.A.", "Nómina", Date.UTC(2026, 4, 29, 21, 50)],
      ["expense", "COP", 1600000, 1600000, "Transferencia a *01700001523", "Transferencias", Date.UTC(2026, 5, 14, 15, 57)],
    ] as const;
    for (const [type, currency, amountMinor, amountCopMinor, merchant, categoryName, occurredAt] of values) {
      const importId = currency === "USD"
        ? await ctx.db.insert("smsImports", {
            userId,
            sender: "874-00",
            rawMessage:
              "Bancolombia: Compraste USD17,18 en HETZNER ONLINE GMBH, el 03/06/2026 a las 20:57. Esta compra esta asociada a T.Cred *9347.",
            normalizedHash: `demo-${userId}-hetzner`,
            receivedAt: occurredAt,
            status: "pending",
            parserRule: "purchase_usd",
          })
        : undefined;
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        type,
        status: amountCopMinor === undefined ? "pending" : "confirmed",
        currency,
        amountMinor,
        amountCopMinor,
        merchant,
        categoryName,
        occurredAt,
        source: "manual",
        smsImportId: importId,
        accountLabel: currency === "USD" ? "T.Cred *9347" : undefined,
      });
      if (importId) {
        await ctx.db.patch("smsImports", importId, { transactionId });
      }
    }
    return true;
  },
});
