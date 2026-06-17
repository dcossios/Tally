/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const startAt = Date.parse("2026-06-01T00:00:00-05:00");
const endAt = Date.parse("2026-07-01T00:00:00-05:00");

async function authedTest() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return { t, userId, authed: t.withIdentity({ subject: userId }) };
}

describe("goals API", () => {
  it("creates, lists, updates, and archives goals", async () => {
    const { authed } = await authedTest();

    const id = await authed.mutation(api.goals.create, {
      kind: "saving",
      name: "Viaje",
      targetMinor: 1_000_000,
      startAt,
      endAt,
    });

    let goals = await authed.query(api.goals.list);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      _id: id,
      kind: "saving",
      name: "Viaje",
      currentMinor: 0,
    });

    await authed.mutation(api.goals.update, {
      id,
      kind: "spendingLimit",
      name: "Junio",
      targetMinor: 500_000,
      startAt,
      endAt,
    });
    goals = await authed.query(api.goals.list);
    expect(goals[0]).toMatchObject({
      kind: "spendingLimit",
      name: "Junio",
      targetMinor: 500_000,
    });

    await authed.mutation(api.goals.archive, { id });
    goals = await authed.query(api.goals.list);
    expect(goals).toHaveLength(0);
  });

  it("calculates progress and records each spending alert once", async () => {
    const { t, userId, authed } = await authedTest();

    const goalId = await authed.mutation(api.goals.create, {
      kind: "spendingLimit",
      name: "Comidas",
      targetMinor: 100_000,
      startAt,
      endAt,
    });

    await authed.mutation(api.transactions.create, {
      type: "expense",
      currency: "COP",
      amountMinor: 80_000,
      amountCopMinor: 80_000,
      merchant: "Restaurante",
      categoryName: "Comidas",
      occurredAt: Date.parse("2026-06-15T12:00:00-05:00"),
    });
    await authed.mutation(api.transactions.create, {
      type: "expense",
      currency: "COP",
      amountMinor: 70_000,
      merchant: "Pendiente",
      categoryName: "Comidas",
      occurredAt: Date.parse("2026-06-16T12:00:00-05:00"),
    });

    const goals = await authed.query(api.goals.list);
    expect(goals[0]).toMatchObject({
      _id: goalId,
      currentMinor: 80_000,
      remainingMinor: 20_000,
    });

    await t.mutation(internal.goals.evaluateSpendingLimitAlerts, { userId });
    await t.mutation(internal.goals.evaluateSpendingLimitAlerts, { userId });

    const alertStates = await t.run((ctx) =>
      ctx.db
        .query("goalAlertStates")
        .withIndex("by_userId_and_goalId", (q) =>
          q.eq("userId", userId as Id<"users">).eq("goalId", goalId),
        )
        .take(10),
    );
    expect(alertStates).toHaveLength(1);
    expect(alertStates[0].threshold).toBe(80);
  });
});

