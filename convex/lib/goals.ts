export type GoalKind = "saving" | "spendingLimit";

export type GoalProgressInput = {
  kind: GoalKind;
  categoryName?: string;
};

export type GoalTransactionInput = {
  type: "expense" | "income";
  status: "confirmed" | "pending";
  amountCopMinor?: number;
  categoryName: string;
};

export function calculateGoalProgress(
  goal: GoalProgressInput,
  transactions: readonly GoalTransactionInput[],
) {
  let currentMinor = 0;

  for (const transaction of transactions) {
    if (transaction.status !== "confirmed") continue;
    if (transaction.amountCopMinor === undefined) continue;

    if (goal.kind === "saving") {
      currentMinor += transaction.type === "income"
        ? transaction.amountCopMinor
        : -transaction.amountCopMinor;
      continue;
    }

    if (transaction.type !== "expense") continue;
    if (goal.categoryName && transaction.categoryName !== goal.categoryName) {
      continue;
    }
    currentMinor += transaction.amountCopMinor;
  }

  return currentMinor;
}

export function progressRatio(currentMinor: number, targetMinor: number) {
  if (targetMinor <= 0) return 0;
  return Math.max(0, currentMinor / targetMinor);
}
