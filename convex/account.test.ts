/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const nov = {
  monthStart: Date.parse("2026-11-01T00:00:00-05:00"),
  monthEnd: Date.parse("2026-12-01T00:00:00-05:00"),
};
const oct = {
  startAt: Date.parse("2026-10-01T00:00:00-05:00"),
  endAt: Date.parse("2026-11-01T00:00:00-05:00"),
};

async function authedTest() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return { t, userId, authed: t.withIdentity({ subject: userId }) };
}

async function addTx(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  type: "income" | "expense",
  amount: number,
  occurredAt: number,
) {
  return t.run((ctx) =>
    ctx.db.insert("transactions", {
      userId,
      type,
      status: "confirmed",
      currency: "COP",
      amountMinor: amount,
      amountCopMinor: amount,
      merchant: "Test",
      categoryName: "Otros",
      occurredAt,
      source: "manual",
    }),
  );
}

describe("account balance and reset", () => {
  it("adds movements after the start date to the opening balance", async () => {
    const { t, userId, authed } = await authedTest();
    const start = Date.parse("2026-11-03T00:00:00-05:00");
    await addTx(t, userId, "income", 999_00, start - 1000); // antes: no cuenta
    await authed.mutation(api.account.setOpeningBalance, {
      openingBalanceMinor: 1_000_000_00,
      startAt: start,
    });
    await addTx(t, userId, "income", 200_000_00, start + 1000);
    await addTx(t, userId, "expense", 50_000_00, start + 2000);

    const data = await authed.query(api.transactions.dashboard, nov);
    expect(data.account?.balanceMinor).toBe(1_150_000_00);
    expect(data.balanceMinor).toBe(150_999_00);
  });

  it("adds dollars at the saved rate to the opening balance", async () => {
    const { t, userId, authed } = await authedTest();
    const start = Date.parse("2026-11-03T00:00:00-05:00");
    await authed.mutation(api.account.setOpeningBalance, {
      openingBalanceMinor: 2_000_000_00,
      openingUsdMinor: 500_00,
      usdRateCopMinor: 4_100_00,
      startAt: start,
    });
    await addTx(t, userId, "income", 200_000_00, start + 1000);
    await addTx(t, userId, "expense", 50_000_00, start + 2000);

    const data = await authed.query(api.transactions.dashboard, nov);
    expect(data.account).toMatchObject({
      openingBalanceMinor: 2_000_000_00,
      openingUsdMinor: 500_00,
      usdRateCopMinor: 4_100_00,
      openingTotalMinor: 4_050_000_00,
      balanceMinor: 4_200_000_00,
    });
  });

  it("accepts dollars only, and requires a rate for them", async () => {
    const { authed } = await authedTest();
    await expect(
      authed.mutation(api.account.setOpeningBalance, {
        openingBalanceMinor: 0,
        openingUsdMinor: 100_00,
        startAt: nov.monthStart,
      }),
    ).rejects.toThrow("Ingresa la tasa de cambio.");

    await authed.mutation(api.account.setOpeningBalance, {
      openingBalanceMinor: 0,
      openingUsdMinor: 100_50,
      usdRateCopMinor: 4_000_00,
      startAt: nov.monthStart,
    });
    const saved = await authed.query(api.account.getOpeningBalance, {});
    expect(saved?.openingTotalMinor).toBe(402_000_00);
  });

  it("saving again without dollars removes them", async () => {
    const { authed } = await authedTest();
    await authed.mutation(api.account.setOpeningBalance, {
      openingBalanceMinor: 1_000_00,
      openingUsdMinor: 10_00,
      usdRateCopMinor: 4_000_00,
      startAt: nov.monthStart,
    });
    await authed.mutation(api.account.setOpeningBalance, {
      openingBalanceMinor: 1_000_00,
      startAt: nov.monthStart,
    });
    const saved = await authed.query(api.account.getOpeningBalance, {});
    expect(saved).toMatchObject({
      openingUsdMinor: 0,
      usdRateCopMinor: null,
      openingTotalMinor: 1_000_00,
    });
  });

  it("reset all can start with pesos plus dollars", async () => {
    const { t, userId, authed } = await authedTest();
    await addTx(t, userId, "income", 5_00, nov.monthStart + 1000);
    await authed.mutation(api.account.resetAll, {
      openingBalanceMinor: 100_000_00,
      openingUsdMinor: 50_00,
      usdRateCopMinor: 4_000_00,
    });
    const data = await authed.query(api.transactions.dashboard, nov);
    expect(data.account?.balanceMinor).toBe(300_000_00);
  });

  it("resets only the chosen month", async () => {
    const { t, userId, authed } = await authedTest();
    await addTx(t, userId, "expense", 10_00, oct.startAt + 1000);
    await addTx(t, userId, "expense", 20_00, nov.monthStart + 1000);

    expect(await authed.query(api.account.countForReset, oct)).toBe(1);
    await authed.mutation(api.account.resetMonth, oct);

    expect(await authed.query(api.account.countForReset, oct)).toBe(0);
    expect(await authed.query(api.account.countForReset, {})).toBe(1);
  });

  it("resets everything, discards SMS and can set a new opening balance", async () => {
    const { t, userId, authed } = await authedTest();
    const smsId = await t.run((ctx) =>
      ctx.db.insert("smsImports", {
        userId,
        sender: "874-00",
        rawMessage: "x",
        normalizedHash: "h",
        receivedAt: nov.monthStart + 1000,
        status: "pending",
        parserRule: "x",
      }),
    );
    await addTx(t, userId, "income", 5_00, nov.monthStart + 1000);
    await addTx(t, userId, "expense", 3_00, oct.startAt + 1000);

    await authed.mutation(api.account.resetAll, { openingBalanceMinor: 700_000_00 });

    expect(await authed.query(api.account.countForReset, {})).toBe(0);
    const sms = await t.run((ctx) => ctx.db.get("smsImports", smsId));
    expect(sms?.status).toBe("discarded");
    const data = await authed.query(api.transactions.dashboard, nov);
    expect(data.incomeMinor).toBe(0);
    expect(data.expenseMinor).toBe(0);
    expect(data.pendingCount).toBe(0);
    expect(data.account?.balanceMinor).toBe(700_000_00);
  });

  it("reset all without amount leaves everything at zero", async () => {
    const { t, userId, authed } = await authedTest();
    await authed.mutation(api.account.setOpeningBalance, {
      openingBalanceMinor: 100_00,
      startAt: nov.monthStart,
    });
    await addTx(t, userId, "income", 5_00, nov.monthStart + 1000);
    await authed.mutation(api.account.resetAll, {});
    const data = await authed.query(api.transactions.dashboard, nov);
    expect(data.account).toBeNull();
    expect(data.balanceMinor).toBe(0);
  });
});
