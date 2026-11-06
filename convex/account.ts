import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireUserId } from "./lib/auth";

// Límite de filas por transacción al borrar; lo que sobre se agenda en otra.
const RESET_BATCH = 250;
// Tope de movimientos que se leen para calcular el saldo de la cuenta.
const BALANCE_SCAN_LIMIT = 8000;

async function getSettings(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return ctx.db
    .query("accountSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

async function writeOpeningBalance(
  ctx: MutationCtx,
  userId: Id<"users">,
  openingBalanceMinor: number,
  startAt: number,
) {
  if (!Number.isFinite(openingBalanceMinor)) throw new Error("Monto inválido.");
  const current = await getSettings(ctx, userId);
  const fields = {
    openingBalanceMinor: Math.round(openingBalanceMinor),
    startAt,
    updatedAt: Date.now(),
  };
  if (current) await ctx.db.patch("accountSettings", current._id, fields);
  else await ctx.db.insert("accountSettings", { userId, ...fields });
}

/** Saldo de la cuenta = saldo inicial + ingresos − gastos desde la fecha inicial. */
export async function computeAccountBalance(
  ctx: QueryCtx,
  userId: Id<"users">,
) {
  const settings = await getSettings(ctx, userId);
  if (!settings) return null;
  const rows = await ctx.db
    .query("transactions")
    .withIndex("by_userId_and_occurredAt", (q) =>
      q.eq("userId", userId).gte("occurredAt", settings.startAt),
    )
    .take(BALANCE_SCAN_LIMIT);
  let netMinor = 0;
  for (const row of rows) {
    if (row.status !== "confirmed" || row.amountCopMinor === undefined) continue;
    netMinor += row.type === "income" ? row.amountCopMinor : -row.amountCopMinor;
  }
  return {
    openingBalanceMinor: settings.openingBalanceMinor,
    startAt: settings.startAt,
    balanceMinor: settings.openingBalanceMinor + netMinor,
  };
}

export const getOpeningBalance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const settings = await getSettings(ctx, userId);
    if (!settings) return null;
    return {
      openingBalanceMinor: settings.openingBalanceMinor,
      startAt: settings.startAt,
    };
  },
});

export const setOpeningBalance = mutation({
  args: { openingBalanceMinor: v.number(), startAt: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await writeOpeningBalance(ctx, userId, args.openingBalanceMinor, args.startAt);
    return null;
  },
});

export const clearOpeningBalance = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const current = await getSettings(ctx, userId);
    if (current) await ctx.db.delete("accountSettings", current._id);
    return null;
  },
});

/** Cuántos movimientos se borrarían (tope 1000, solo para mostrar). */
export const countForReset = query({
  args: { startAt: v.optional(v.number()), endAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("transactions")
      .withIndex("by_userId_and_occurredAt", (q) => {
        if (args.startAt !== undefined && args.endAt !== undefined) {
          return q
            .eq("userId", userId)
            .gte("occurredAt", args.startAt)
            .lt("occurredAt", args.endAt);
        }
        return q.eq("userId", userId);
      })
      .take(1000);
    return rows.length;
  },
});

/**
 * Borra los movimientos del usuario en un rango (o todos) y descarta los SMS
 * pendientes de ese rango. Los SMS quedan como "discarded" para que el mismo
 * mensaje no se vuelva a importar.
 */
async function deleteBatch(
  ctx: MutationCtx,
  userId: Id<"users">,
  startAt: number | undefined,
  endAt: number | undefined,
) {
  const rows = await ctx.db
    .query("transactions")
    .withIndex("by_userId_and_occurredAt", (q) => {
      if (startAt !== undefined && endAt !== undefined) {
        return q
          .eq("userId", userId)
          .gte("occurredAt", startAt)
          .lt("occurredAt", endAt);
      }
      return q.eq("userId", userId);
    })
    .take(RESET_BATCH);

  for (const row of rows) {
    if (row.smsImportId) {
      const sms = await ctx.db.get("smsImports", row.smsImportId);
      if (sms && sms.status !== "discarded") {
        await ctx.db.patch("smsImports", sms._id, { status: "discarded" });
      }
    }
    await ctx.db.delete("transactions", row._id);
  }

  const pending = await ctx.db
    .query("smsImports")
    .withIndex("by_userId_and_status_and_receivedAt", (q) => {
      const base = q.eq("userId", userId).eq("status", "pending");
      if (startAt !== undefined && endAt !== undefined) {
        return base.gte("receivedAt", startAt).lt("receivedAt", endAt);
      }
      return base;
    })
    .take(RESET_BATCH);
  for (const sms of pending) {
    await ctx.db.patch("smsImports", sms._id, { status: "discarded" });
  }

  const hasMore = rows.length === RESET_BATCH || pending.length === RESET_BATCH;
  if (hasMore) {
    await ctx.scheduler.runAfter(0, internal.account.continueReset, {
      userId,
      startAt,
      endAt,
    });
  }
  return { deleted: rows.length, hasMore };
}

export const continueReset = internalMutation({
  args: {
    userId: v.id("users"),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await deleteBatch(ctx, args.userId, args.startAt, args.endAt);
    return null;
  },
});

export const resetMonth = mutation({
  args: { startAt: v.number(), endAt: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.endAt <= args.startAt) throw new Error("Rango inválido.");
    const result = await deleteBatch(ctx, userId, args.startAt, args.endAt);
    return result.deleted;
  },
});

export const resetAll = mutation({
  args: { openingBalanceMinor: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await deleteBatch(ctx, userId, undefined, undefined);
    if (args.openingBalanceMinor !== undefined) {
      await writeOpeningBalance(ctx, userId, args.openingBalanceMinor, Date.now());
    } else {
      const current = await getSettings(ctx, userId);
      if (current) await ctx.db.delete("accountSettings", current._id);
    }
    return result.deleted;
  },
});
