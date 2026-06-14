import type { Doc } from "../../convex/_generated/dataModel";
import { formatMoney } from "@/lib/format";
import { categoryVisual } from "@/lib/categoryVisual";

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(timestamp);
}

export function TransactionRow({ transaction, onClick }: { transaction: Doc<"transactions">; onClick?: () => void }) {
  const visual = categoryVisual(transaction.categoryName, transaction.type);
  return (
    <button className="tx-row" type="button" onClick={onClick}>
      <span className="cat-icon" style={{ background: visual.bg }}>{visual.emoji}</span>
      <span className="tx-main">
        <strong>{transaction.merchant}</strong>
        <small>{transaction.status === "pending" ? "Por revisar" : formatTime(transaction.occurredAt)}</small>
      </span>
      <span className="tx-amount" data-type={transaction.type}>
        {formatMoney(transaction.amountMinor, transaction.currency, transaction.type === "income" ? "positive" : "negative")}
      </span>
    </button>
  );
}
