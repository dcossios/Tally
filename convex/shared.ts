import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireSpaceMembership, requireUserId } from "./lib/auth";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Sin caracteres ambiguos (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function periodForTimestamp(ts: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).format(ts);
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let suffix = "";
  for (const byte of bytes) suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `SALDO-${suffix}`;
}

// ---------- Espacio / invitaciones ----------

export const getMySpace = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const membership = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!membership) return null;
    const space = await ctx.db.get("sharedSpaces", membership.spaceId);
    if (!space) return null;

    const memberships = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_spaceId", (q) => q.eq("spaceId", membership.spaceId))
      .take(2);
    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get("users", m.userId);
        return { userId: m.userId, name: user?.name ?? "Usuario", role: m.role };
      }),
    );

    let inviteCode: string | null = null;
    if (members.length < 2) {
      const now = Date.now();
      const invites = await ctx.db
        .query("sharedInvites")
        .withIndex("by_spaceId", (q) => q.eq("spaceId", membership.spaceId))
        .order("desc")
        .take(10);
      const active = invites.find(
        (i) => i.redeemedBy === undefined && i.expiresAt > now,
      );
      inviteCode = active?.code ?? null;
    }

    return {
      space,
      members,
      myRole: membership.role,
      myUserId: userId,
      inviteCode,
    };
  },
});

export const createSpace = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) throw new Error("Ya perteneces a un espacio compartido.");
    const now = Date.now();
    const spaceId = await ctx.db.insert("sharedSpaces", {
      name: args.name.trim() || "Nuestro bolsillo",
      createdBy: userId,
      createdAt: now,
    });
    await ctx.db.insert("sharedMemberships", {
      spaceId,
      userId,
      role: "owner",
      joinedAt: now,
    });
    return spaceId;
  },
});

export const generateInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const { spaceId, userId } = await requireSpaceMembership(ctx);
    const memberships = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_spaceId", (q) => q.eq("spaceId", spaceId))
      .take(2);
    if (memberships.length >= 2) {
      throw new Error("El espacio ya tiene dos miembros.");
    }
    let code = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = randomCode();
      const clash = await ctx.db
        .query("sharedInvites")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .unique();
      if (!clash) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("No se pudo generar el código. Intenta de nuevo.");
    const now = Date.now();
    await ctx.db.insert("sharedInvites", {
      spaceId,
      code,
      createdBy: userId,
      createdAt: now,
      expiresAt: now + WEEK_MS,
    });
    return code;
  },
});

export const joinByCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) throw new Error("Ya perteneces a un espacio compartido.");

    const code = args.code.trim().toUpperCase();
    const invite = await ctx.db
      .query("sharedInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!invite) throw new Error("Código inválido.");
    if (invite.redeemedBy !== undefined) throw new Error("Ese código ya fue usado.");
    if (invite.expiresAt < Date.now()) throw new Error("El código expiró.");

    const memberships = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_spaceId", (q) => q.eq("spaceId", invite.spaceId))
      .take(2);
    if (memberships.length >= 2) throw new Error("El espacio ya está completo.");

    const now = Date.now();
    await ctx.db.insert("sharedMemberships", {
      spaceId: invite.spaceId,
      userId,
      role: "member",
      joinedAt: now,
    });
    await ctx.db.patch("sharedInvites", invite._id, {
      redeemedBy: userId,
      redeemedAt: now,
    });
    return invite.spaceId;
  },
});

export const leaveSpace = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const membership = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (membership) await ctx.db.delete("sharedMemberships", membership._id);
    return null;
  },
});

// ---------- Ledger ----------

export const getSpaceDashboard = query({
  args: { period: v.string() },
  handler: async (ctx, args) => {
    const { spaceId } = await requireSpaceMembership(ctx);
    const entries = await ctx.db
      .query("sharedEntries")
      .withIndex("by_spaceId_and_occurredAt", (q) => q.eq("spaceId", spaceId))
      .order("desc")
      .take(500);

    let commonBalanceMinor = 0;
    let savingsBalanceMinor = 0;
    const contributionsByMember: Record<string, number> = {};
    let monthContributionsMinor = 0;
    let monthExpensesMinor = 0;
    for (const entry of entries) {
      commonBalanceMinor += entry.commonDeltaMinor;
      savingsBalanceMinor += entry.savingsDeltaMinor;
      if (entry.period !== args.period) continue;
      if (entry.kind === "contribution") {
        monthContributionsMinor += entry.amountMinor;
        if (entry.memberId) {
          const key = entry.memberId;
          contributionsByMember[key] =
            (contributionsByMember[key] ?? 0) + entry.amountMinor;
        }
      } else if (entry.kind === "expense") {
        monthExpensesMinor += entry.amountMinor;
      }
    }

    const memberships = await ctx.db
      .query("sharedMemberships")
      .withIndex("by_spaceId", (q) => q.eq("spaceId", spaceId))
      .take(2);
    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get("users", m.userId);
        return { userId: m.userId, name: user?.name ?? "Usuario", role: m.role };
      }),
    );

    const closure = await ctx.db
      .query("sharedMonthClosures")
      .withIndex("by_spaceId_and_period", (q) =>
        q.eq("spaceId", spaceId).eq("period", args.period),
      )
      .unique();

    return {
      commonBalanceMinor,
      savingsBalanceMinor,
      members,
      contributionsByMember,
      monthContributionsMinor,
      monthExpensesMinor,
      isClosed: closure !== null,
      recent: entries.slice(0, 8),
    };
  },
});

export const listEntries = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { spaceId } = await requireSpaceMembership(ctx);
    return ctx.db
      .query("sharedEntries")
      .withIndex("by_spaceId_and_occurredAt", (q) => q.eq("spaceId", spaceId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const contribute = mutation({
  args: { amountMinor: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, spaceId } = await requireSpaceMembership(ctx);
    if (args.amountMinor <= 0) throw new Error("Ingresa un monto.");
    const now = Date.now();
    // El aporte sale del bolsillo personal de quien aporta.
    const transactionId = await ctx.db.insert("transactions", {
      userId,
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor: args.amountMinor,
      amountCopMinor: args.amountMinor,
      merchant: "Aporte bolsillo común",
      categoryName: "Bolsillo común",
      occurredAt: now,
      source: "manual",
      note: args.note,
    });
    return ctx.db.insert("sharedEntries", {
      spaceId,
      kind: "contribution",
      commonDeltaMinor: args.amountMinor,
      savingsDeltaMinor: 0,
      amountMinor: args.amountMinor,
      memberId: userId,
      linkedTransactionId: transactionId,
      merchant: "Aporte",
      note: args.note,
      period: periodForTimestamp(now),
      occurredAt: now,
      createdBy: userId,
    });
  },
});

export const addSharedExpense = mutation({
  args: {
    amountMinor: v.number(),
    merchant: v.string(),
    categoryName: v.optional(v.string()),
    note: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, spaceId } = await requireSpaceMembership(ctx);
    if (args.amountMinor <= 0) throw new Error("Ingresa un monto.");
    const occurredAt = args.occurredAt ?? Date.now();
    return ctx.db.insert("sharedEntries", {
      spaceId,
      kind: "expense",
      commonDeltaMinor: -args.amountMinor,
      savingsDeltaMinor: 0,
      amountMinor: args.amountMinor,
      memberId: userId,
      merchant: args.merchant.trim() || "Salida",
      categoryName: args.categoryName,
      note: args.note,
      period: periodForTimestamp(occurredAt),
      occurredAt,
      createdBy: userId,
    });
  },
});

export const withdrawSavings = mutation({
  args: {
    amountMinor: v.number(),
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, spaceId } = await requireSpaceMembership(ctx);
    if (args.amountMinor <= 0) throw new Error("Ingresa un monto.");
    const now = Date.now();
    return ctx.db.insert("sharedEntries", {
      spaceId,
      kind: "savingsExpense",
      commonDeltaMinor: 0,
      savingsDeltaMinor: -args.amountMinor,
      amountMinor: args.amountMinor,
      memberId: userId,
      merchant: args.merchant?.trim() || "Retiro de ahorro",
      note: args.note,
      period: periodForTimestamp(now),
      occurredAt: now,
      createdBy: userId,
    });
  },
});

export const closeMonth = mutation({
  args: { period: v.string() },
  handler: async (ctx, args) => {
    const { userId, spaceId } = await requireSpaceMembership(ctx);
    const existing = await ctx.db
      .query("sharedMonthClosures")
      .withIndex("by_spaceId_and_period", (q) =>
        q.eq("spaceId", spaceId).eq("period", args.period),
      )
      .unique();
    if (existing) throw new Error("El mes ya fue cerrado.");

    const entries = await ctx.db
      .query("sharedEntries")
      .withIndex("by_spaceId_and_occurredAt", (q) => q.eq("spaceId", spaceId))
      .take(500);
    let leftover = 0;
    for (const entry of entries) leftover += entry.commonDeltaMinor;

    const now = Date.now();
    const movedToSavingsMinor = leftover > 0 ? leftover : 0;
    let rolloverEntryId: Id<"sharedEntries"> | undefined;
    if (movedToSavingsMinor > 0) {
      rolloverEntryId = await ctx.db.insert("sharedEntries", {
        spaceId,
        kind: "rollover",
        commonDeltaMinor: -movedToSavingsMinor,
        savingsDeltaMinor: movedToSavingsMinor,
        amountMinor: movedToSavingsMinor,
        merchant: "Cierre de mes",
        period: args.period,
        occurredAt: now,
        createdBy: userId,
      });
    }
    await ctx.db.insert("sharedMonthClosures", {
      spaceId,
      period: args.period,
      movedToSavingsMinor,
      rolloverEntryId,
      closedBy: userId,
      closedAt: now,
    });
    return { movedToSavingsMinor };
  },
});

export const removeEntry = mutation({
  args: { id: v.id("sharedEntries") },
  handler: async (ctx, args) => {
    const { spaceId } = await requireSpaceMembership(ctx);
    const entry = await ctx.db.get("sharedEntries", args.id);
    if (!entry || entry.spaceId !== spaceId) throw new Error("No encontrado.");
    if (entry.kind === "rollover") {
      throw new Error("No puedes borrar un cierre de mes.");
    }
    const closure = await ctx.db
      .query("sharedMonthClosures")
      .withIndex("by_spaceId_and_period", (q) =>
        q.eq("spaceId", spaceId).eq("period", entry.period),
      )
      .unique();
    if (closure) throw new Error("Ese mes ya fue cerrado.");
    if (entry.linkedTransactionId) {
      const tx = await ctx.db.get("transactions", entry.linkedTransactionId);
      if (tx) await ctx.db.delete("transactions", entry.linkedTransactionId);
    }
    await ctx.db.delete("sharedEntries", args.id);
    return null;
  },
});
