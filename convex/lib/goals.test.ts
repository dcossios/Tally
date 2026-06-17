import { describe, expect, it } from "vitest";
import { calculateGoalProgress } from "./goals";

const rows = [
  {
    type: "income",
    status: "confirmed",
    amountCopMinor: 500_000,
    categoryName: "Nómina",
  },
  {
    type: "expense",
    status: "confirmed",
    amountCopMinor: 120_000,
    categoryName: "Compras",
  },
  {
    type: "expense",
    status: "confirmed",
    amountCopMinor: 80_000,
    categoryName: "Transporte",
  },
  {
    type: "expense",
    status: "pending",
    amountCopMinor: 90_000,
    categoryName: "Compras",
  },
  {
    type: "expense",
    status: "confirmed",
    categoryName: "Compras",
  },
] as const;

describe("calculateGoalProgress", () => {
  it("calculates saving as confirmed income minus confirmed expenses", () => {
    expect(calculateGoalProgress({ kind: "saving" }, rows)).toBe(300_000);
  });

  it("calculates a total spending limit from confirmed expenses", () => {
    expect(calculateGoalProgress({ kind: "spendingLimit" }, rows)).toBe(200_000);
  });

  it("calculates category spending limits", () => {
    expect(calculateGoalProgress({ kind: "spendingLimit", categoryName: "Compras" }, rows)).toBe(120_000);
  });

  it("ignores pending transactions and missing COP amounts", () => {
    expect(calculateGoalProgress({ kind: "spendingLimit", categoryName: "Compras" }, rows)).not.toBe(210_000);
  });
});

