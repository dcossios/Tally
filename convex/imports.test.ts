/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { sha256 } from "./lib/hash";

const modules = import.meta.glob("./**/*.ts");

describe("imports.processSms", () => {
  it("creates a confirmed transaction for a Bancolombia Bre-B transfer from 874-00", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "David", email: "david@example.com" }),
    );
    const token = "saldo_test_token_abcdefghijklmnopqrstuvwxyz123456";
    const tokenHash = await sha256(token);
    await t.run(async (ctx) =>
      ctx.db.insert("shortcutTokens", {
        userId,
        name: "iPhone principal",
        tokenHash,
        prefix: token.slice(0, 8),
        createdAt: Date.now(),
      }),
    );

    const message =
      "Bancolombia: DAVID, transferiste $12.00 a la llave @dco781 desde tu cuenta *7181 a David Cossio el 14/06/26 a las 20:02. Con Bre-b es de una y gratis. Dudas al 018000912345";

    const result = await t.mutation(internal.imports.processSms, {
      tokenHash,
      sender: "874-00",
      message,
      receivedAt: Date.now(),
      normalizedHash: await sha256(`874-00|${message}`),
    });

    expect(result).toMatchObject({
      kind: "created",
      parserRule: "transfer",
    });
    expect("parserError" in result).toBe(false);

    const imports = await t.run(async (ctx) => ctx.db.query("smsImports").take(10));
    const transactions = await t.run(async (ctx) =>
      ctx.db.query("transactions").take(10),
    );

    expect(imports).toHaveLength(1);
    expect(transactions).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      sender: "874-00",
      status: "confirmed",
      parserRule: "transfer",
    });
    expect(transactions[0]).toMatchObject({
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor: 120000,
      amountCopMinor: 120000,
      merchant: "David Cossio",
      categoryName: "Transferencias",
      accountLabel: "Cuenta *7181 · Llave @dco781",
    });

    const duplicate = await t.mutation(internal.imports.processSms, {
      tokenHash,
      sender: "874-00",
      message,
      receivedAt: Date.now(),
      normalizedHash: await sha256(`874-00|${message}`),
    });

    expect(duplicate).toMatchObject({
      kind: "duplicate",
      importId: imports[0]._id,
      transactionId: transactions[0]._id,
      parserRule: "transfer",
      status: "confirmed",
    });
    expect("parserError" in duplicate).toBe(false);
  });
});
