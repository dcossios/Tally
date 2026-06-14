import { ArrowRight, BriefcaseBusiness, Building2, Globe2, ShoppingBag } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatDate, formatMoney } from "@/lib/format";

export function TransactionRow({ transaction, onClick }: { transaction: Doc<"transactions">; onClick?: () => void }) {
  const Icon = transaction.categoryName === "Nómina"
    ? BriefcaseBusiness
    : transaction.categoryName === "Servicios digitales"
      ? Globe2
      : transaction.categoryName === "Vivienda"
        ? Building2
        : ShoppingBag;
  return (
    <button className="transaction-row" type="button" onClick={onClick}>
      <span className="transaction-icon" data-type={transaction.type}><Icon /></span>
      <span className="transaction-main"><strong>{transaction.merchant}</strong><small>{transaction.categoryName}</small></span>
      <span className="transaction-value">
        <strong data-type={transaction.type}>{formatMoney(transaction.amountMinor, transaction.currency, transaction.type === "income" ? "positive" : "negative")}</strong>
        <small>{transaction.status === "pending" ? "Por revisar" : formatDate(transaction.occurredAt)}</small>
      </span>
      <ArrowRight className="row-arrow" />
    </button>
  );
}
