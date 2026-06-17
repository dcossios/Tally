import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";
import { calculateGoalProgress, progressRatio } from "./lib/goals";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const goalKind = v.union(v.literal("saving"), v.literal("spendingLimit"));

const goalFields = {
  kind: goalKind,
  name: v.string(),
  targetMinor: v.number(),
  startAt: v.number(),
  endAt: v.number(),
  categoryId: v.optional(v.id("categories")),
  categoryName: v.optional(v.string()),
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_userId_and_status_and_endAt", (q) =>
        q.eq("userId", userId).eq("status", "active"),
      )
      .order("asc")
      .take(100);

    return Promise.all(
      goals.map(async (goal) => {
        const currentMinor = await currentForGoal(ctx, goal);
        const ratio = progressRatio(currentMinor, goal.targetMinor);
        return {
          ...goal,
          currentMinor,
          ratio,
          remainingMinor:
            goal.kind === "spendingLimit"
              ? Math.max(0, goal.targetMinor - currentMinor)
              : goal.targetMinor - currentMinor,
        };
      }),
    );
  },
});

export const create = mutation({
  args: goalFields,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const normalized = await normalizeGoalInput(ctx, userId, args);
    return ctx.db.insert("goals", {
      ...normalized,
      userId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { id: v.id("goals"), ...goalFields },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const current = await ctx.db.get(args.id);
    if (!current || current.userId !== userId) throw new Error("Meta no encontrada.");
    const { id, ...fields } = args;
    const normalized = await normalizeGoalInput(ctx, userId, fields);
    await ctx.db.patch(id, {
      ...normalized,
      updatedAt: Date.now(),
    });
    const alertStates = await ctx.db
      .query("goalAlertStates")
      .withIndex("by_userId_and_goalId", (q) => q.eq("userId", userId).eq("goalId", id))
      .take(10);
    for (const alertState of alertStates) {
      await ctx.db.delete(alertState._id);
    }
    return null;
  },
});

export const archive = mutation({
  args: { id: v.id("goals") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const current = await ctx.db.get(args.id);
    if (!current || current.userId !== userId) throw new Error("Meta no encontrada.");
    await ctx.db.patch(args.id, { status: "archived", updatedAt: Date.now() });
    return null;
  },
});

export const evaluateSpendingLimitAlerts = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const goals = await ctx.db
      .query("goals")
      .withIndex("by_userId_and_status_and_endAt", (q) =>
        q.eq("userId", args.userId).eq("status", "active").gte("endAt", now),
      )
      .take(100);

    for (const goal of goals) {
      if (goal.kind !== "spendingLimit" || goal.startAt > now) continue;
      const currentMinor = await currentForGoal(ctx, goal);
      const ratio = progressRatio(currentMinor, goal.targetMinor);
      const threshold = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : null;
      if (threshold === null) continue;

      const existing = await ctx.db
        .query("goalAlertStates")
        .withIndex("by_goalId_and_threshold", (q) =>
          q.eq("goalId", goal._id).eq("threshold", threshold),
        )
        .unique();
      if (existing) continue;

      await ctx.db.insert("goalAlertStates", {
        goalId: goal._id,
        userId: args.userId,
        threshold,
        sentAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.pushNotifications.sendGoalAlert, {
        userId: args.userId,
        goalId: goal._id,
        goalName: goal.name,
        threshold,
        currentMinor,
        targetMinor: goal.targetMinor,
      });
    }

    return null;
  },
});

async function normalizeGoalInput(
  ctx: MutationCtx,
  userId: Id<"users">,
  fields: {
    kind: "saving" | "spendingLimit";
    name: string;
    targetMinor: number;
    startAt: number;
    endAt: number;
    categoryId?: Id<"categories">;
    categoryName?: string;
  },
) {
  const name = fields.name.trim();
  if (!name) throw new Error("Ponle un nombre a la meta.");
  if (fields.targetMinor <= 0) throw new Error("Ingresa un monto objetivo válido.");
  if (fields.endAt <= fields.startAt) {
    throw new Error("La fecha final debe ser posterior a la inicial.");
  }

  if (fields.kind === "saving") {
    return {
      kind: fields.kind,
      name,
      targetMinor: fields.targetMinor,
      startAt: fields.startAt,
      endAt: fields.endAt,
      categoryId: undefined,
      categoryName: undefined,
    };
  }

  if (!fields.categoryId) {
    return {
      kind: fields.kind,
      name,
      targetMinor: fields.targetMinor,
      startAt: fields.startAt,
      endAt: fields.endAt,
      categoryId: undefined,
      categoryName: undefined,
    };
  }

  const category = await ctx.db.get(fields.categoryId);
  if (!category || category.userId !== userId || category.kind !== "expense") {
    throw new Error("Categoría no válida.");
  }

  return {
    kind: fields.kind,
    name,
    targetMinor: fields.targetMinor,
    startAt: fields.startAt,
    endAt: fields.endAt,
    categoryId: category._id,
    categoryName: category.name,
  };
}

async function currentForGoal(
  ctx: QueryCtx | MutationCtx,
  goal: Pick<
    Doc<"goals">,
    "userId" | "kind" | "categoryName" | "startAt" | "endAt" | "targetMinor"
  >,
) {
  const rows = await ctx.db
    .query("transactions")
    .withIndex("by_userId_and_occurredAt", (q) =>
      q
        .eq("userId", goal.userId)
        .gte("occurredAt", goal.startAt)
        .lt("occurredAt", goal.endAt),
    )
    .take(1000);

  return calculateGoalProgress(goal, rows);
}
