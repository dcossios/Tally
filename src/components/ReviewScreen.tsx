import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, ChevronDown, Clock3, CreditCard, LockKeyhole, MessageCircle, Store, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate } from "@/lib/format";
import type { ReactNode } from "react";

export function ReviewScreen({ onBack }: { onBack: () => void }) {
  const pending = useQuery(api.imports.pending);
  const review = useMutation(api.imports.review);
  const item = pending?.[0];
  const transaction = item?.transaction;
  const [type, setType] = useState<"expense" | "income">("expense");
  const [copValue, setCopValue] = useState("");
  const amountCopMinor = useMemo(() => copValue ? Math.round(Number(copValue.replace(/\D/g, "")) * 100) : undefined, [copValue]);

  if (!item || !transaction) {
    return <div className="screen review-screen empty-state"><span className="emoji">🙌</span><h3>Todo al día</h3><p>No tienes movimientos por revisar.</p></div>;
  }

  const confirm = async () => {
    try {
      await review({ importId: item._id, action: "confirm", type, amountCopMinor: transaction.currency === "USD" ? amountCopMinor : transaction.amountCopMinor });
      toast.success("Movimiento confirmado.");
      setCopValue("");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="screen review-screen">
      <header className="review-header"><button type="button" onClick={onBack} aria-label="Volver"><ArrowLeft /></button><h1>Revisar movimiento</h1><span>1 de {pending?.length ?? 1}</span></header>
      <p className="review-helper">Confirma los datos detectados antes de incluirlos en tus totales.</p>
      <div className="import-source"><MessageCircle /><strong>Importado desde Messages</strong><span>Pendiente</span></div>
      <label className="form-label">Tipo de movimiento</label>
      <ToggleGroup type="single" value={type} onValueChange={(value) => value && setType(value as "expense" | "income")} className="type-toggle">
        <ToggleGroupItem value="expense">↓ Gasto</ToggleGroupItem><ToggleGroupItem value="income">↑ Ingreso</ToggleGroupItem>
      </ToggleGroup>
      <label className="form-label">Monto</label>
      <div className="amount-display"><span>{transaction.currency}</span><strong>{new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2 }).format(transaction.amountMinor / 100)}</strong></div>
      {transaction.currency === "USD" ? (
        <><label className="form-label" htmlFor="cop-value">Equivalente en COP</label><div className="cop-input"><Input id="cop-value" inputMode="numeric" placeholder="Ingresa el valor cobrado en COP" value={copValue} onChange={(event) => setCopValue(event.target.value)} /><span>COP</span></div></>
      ) : null}
      <div className="detail-list">
        <Detail icon={<Store />} label="Comercio" value={transaction.merchant} />
        <Detail icon={<Tag />} label="Categoría" value={transaction.categoryName} />
        <Detail icon={<CalendarDays />} label="Fecha" value={formatDate(transaction.occurredAt, true)} />
        <Detail icon={<Clock3 />} label="Hora" value={new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(transaction.occurredAt)} />
        <Detail icon={<CreditCard />} label="Cuenta o tarjeta" value={(transaction.accountLabel ?? "Sin identificar").replace("*", "•")} />
      </div>
      <details className="raw-message"><summary>Mensaje original <ChevronDown /></summary><p>{item.rawMessage}</p></details>
      <div className="review-actions">
        <Button size="lg" onClick={() => void confirm()} disabled={transaction.currency === "USD" && !amountCopMinor}>Confirmar movimiento</Button>
        <Button variant="ghost" className="discard-button" onClick={() => void review({ importId: item._id, action: "discard" }).then(() => toast.success("Importación descartada."))}>Descartar</Button>
        <small><LockKeyhole /> Recibido automáticamente por Shortcut</small>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="detail-row"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div><b>›</b></div>;
}
