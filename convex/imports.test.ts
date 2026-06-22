/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("imports.processSms", () => {
  it("ignores rejected suspicious transfer alerts without creating a transaction", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    await t.run((ctx) =>
      ctx.db.insert("shortcutTokens", {
        userId,
        name: "iPhone",
        tokenHash: "token-hash",
        prefix: "tok",
        createdAt: Date.now(),
      }),
    );

    const result = await t.mutation(internal.imports.processSms, {
      tokenHash: "token-hash",
      sender: "Bancolombia",
      message:
        "Bancolombia: MARIA SALAZAR. Notamos una transferencia sospechosa desde tu cuenta corriente terminada en *6261 a la cuenta *6604 por valor de $200,000. Por tu seguridad rechazamos la transferencia el 2026/06/17 a las 12:49. Si tienes dudas, encuentranos aqui: 018000912345, opciones 3-3.",
      receivedAt: Date.now(),
      normalizedHash: "normalized-hash",
    });

    const counts = await t.run(async (ctx) => {
      const transactions = await ctx.db.query("transactions").take(10);
      const imports = await ctx.db.query("smsImports").take(10);
      return { transactions: transactions.length, imports: imports.length };
    });

    expect(result).toEqual({ kind: "ignored" });
    expect(counts).toEqual({ transactions: 0, imports: 0 });
  });
});
