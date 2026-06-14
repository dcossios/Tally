import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";
import { normalizeMessage } from "./lib/hash";
import { parseBancolombiaSms } from "./lib/smsParser";

const ALLOWED_SENDERS = new Set(["855-40", "852-86", "874-00", "857-84"]);

export const processSms = internalMutation({
  args: {
    tokenHash: v.string(),
    sender: v.string(),
    message: v.string(),
    receivedAt: v.number(),
    normalizedHash: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("shortcutTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!token || token.revokedAt !== undefined) {
      return { kind: "unauthorized" as const };
    }
    if (!ALLOWED_SENDERS.has(args.sender)) {
      return { kind: "sender_not_allowed" as const };
    }
    const duplicate = await ctx.db
      .query("smsImports")
      .withIndex("by_userId_and_normalizedHash", (q) =>
        q.eq("userId", token.userId).eq("normalizedHash", args.normalizedHash),
      )
      .unique();
    if (duplicate) {
      return { kind: "duplicate" as const, importId: duplicate._id };
    }

    const parsed = parseBancolombiaSms(normalizeMessage(args.message));
    const importId = await ctx.db.insert("smsImports", {
      userId: token.userId,
      sender: args.sender,
      rawMessage: args.message,
      normalizedHash: args.normalizedHash,
      receivedAt: args.receivedAt,
      status: parsed.status,
      parserRule: parsed.rule,
      error: parsed.error,
    });
    const transactionId = await ctx.db.insert("transactions", {
      userId: token.userId,
      type: parsed.type,
      status: parsed.status,
      currency: parsed.currency,
      amountMinor: parsed.amountMinor,
      amountCopMinor: parsed.amountCopMinor,
      merchant: parsed.merchant,
      categoryName: parsed.categoryName,
      occurredAt: parsed.occurredAt,
      source: "sms",
      smsImportId: importId,
      accountLabel: parsed.accountLabel,
    });
    await ctx.db.patch("smsImports", importId, { transactionId });
    await ctx.db.patch("shortcutTokens", token._id, { lastUsedAt: Date.now() });
    return {
      kind: parsed.status === "pending" ? ("pending" as const) : ("created" as const),
      importId,
      transactionId,
    };
  },
});

export const pending = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const imports = await ctx.db
      .query("smsImports")
      .withIndex("by_userId_and_status_and_receivedAt", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .order("desc")
      .take(50);
    return Promise.all(
      imports.map(async (item) => ({
        ...item,
        transaction: item.transactionId
          ? await ctx.db.get("transactions", item.transactionId)
          : null,
      })),
    );
  },
});

export const review = mutation({
  args: {
    importId: v.id("smsImports"),
    action: v.union(v.literal("confirm"), v.literal("discard")),
    type: v.optional(v.union(v.literal("expense"), v.literal("income"))),
    amountMinor: v.optional(v.number()),
    amountCopMinor: v.optional(v.number()),
    merchant: v.optional(v.string()),
    categoryName: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const item = await ctx.db.get("smsImports", args.importId);
    if (!item || item.userId !== userId || !item.transactionId) {
      throw new Error("Importación no encontrada.");
    }
    if (args.action === "discard") {
      await ctx.db.patch("smsImports", item._id, { status: "discarded" });
      await ctx.db.delete("transactions", item.transactionId);
      return null;
    }
    const transaction = await ctx.db.get("transactions", item.transactionId);
    if (!transaction) throw new Error("Movimiento no encontrado.");
    if (transaction.currency === "USD" && args.amountCopMinor === undefined) {
      throw new Error("Ingresa el equivalente real en COP.");
    }
    if (args.amountMinor !== undefined && args.amountMinor <= 0) {
      throw new Error("Ingresa un monto válido.");
    }
    await ctx.db.patch("transactions", transaction._id, {
      status: "confirmed",
      type: args.type ?? transaction.type,
      amountMinor: args.amountMinor ?? transaction.amountMinor,
      amountCopMinor: args.amountCopMinor ?? transaction.amountCopMinor,
      merchant: args.merchant?.trim() || transaction.merchant,
      categoryName: args.categoryName?.trim() || transaction.categoryName,
      occurredAt: args.occurredAt ?? transaction.occurredAt,
    });
    await ctx.db.patch("smsImports", item._id, { status: "confirmed" });
    return null;
  },
});
