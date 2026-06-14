import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
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
  const categories = useQuery(api.categories.list, {
    kind: transaction?.type ?? "expense",
  });
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amountValue, setAmountValue] = useState("");
  const [copValue, setCopValue] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const amountMinor = useMemo(
    () =>
      amountValue
        ? Math.round(Number(amountValue.replace(/[^\d]/g, "")) * 100)
        : undefined,
    [amountValue],
  );
  const amountCopMinor = useMemo(
    () =>
      copValue ? Math.round(Number(copValue.replace(/[^\d]/g, "")) * 100) : undefined,
    [copValue],
  );

  useEffect(() => {
    if (!transaction) return;
    setType(transaction.type);
    setAmountValue(String(transaction.amountMinor / 100));
    setCategoryName(transaction.categoryName);
    setCopValue(
      transaction.amountCopMinor !== undefined
        ? String(transaction.amountCopMinor / 100)
        : "",
    );
  }, [transaction]);

  if (!item || !transaction) {
    return <div className="screen review-screen empty-state"><span className="emoji">🙌</span><h3>Todo al día</h3><p>No tienes movimientos por revisar.</p></div>;
  }

  const confirm = async () => {
    try {
      await review({
        importId: item._id,
        action: "confirm",
        type,
        amountMinor: amountMinor ?? transaction.amountMinor,
        amountCopMinor:
          transaction.currency === "USD"
            ? amountCopMinor
            : amountMinor ?? transaction.amountCopMinor,
        categoryName: categoryName || transaction.categoryName,
      });
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
      <div className="cop-input">
        <Input
          inputMode="decimal"
          placeholder="Ingresa el monto"
          value={amountValue}
          onChange={(event) => setAmountValue(event.target.value)}
        />
        <span>{transaction.currency}</span>
      </div>
      {transaction.currency === "USD" ? (
        <><label className="form-label" htmlFor="cop-value">Equivalente en COP</label><div className="cop-input"><Input id="cop-value" inputMode="numeric" placeholder="Ingresa el valor cobrado en COP" value={copValue} onChange={(event) => setCopValue(event.target.value)} /><span>COP</span></div></>
      ) : null}
      <div className="detail-list">
        <Detail icon={<Store />} label="Comercio" value={transaction.merchant} />
        <div className="detail-row">
          <span><Tag /></span>
          <div>
            <small>Categoría</small>
            <select
              className="review-select"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            >
              <option value={categoryName || transaction.categoryName}>
                {categoryName || transaction.categoryName}
              </option>
              {(categories ?? [])
                .filter(
                  (category) =>
                    category.name !== (categoryName || transaction.categoryName),
                )
                .map((category) => (
                  <option key={category._id} value={category.name}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>
          <b>›</b>
        </div>
        <Detail icon={<CalendarDays />} label="Fecha" value={formatDate(transaction.occurredAt, true)} />
        <Detail icon={<Clock3 />} label="Hora" value={new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(transaction.occurredAt)} />
        <Detail icon={<CreditCard />} label="Cuenta o tarjeta" value={(transaction.accountLabel ?? "Sin identificar").replace("*", "•")} />
      </div>
      <details className="raw-message"><summary>Mensaje original <ChevronDown /></summary><p>{item.rawMessage}</p></details>
      <div className="review-actions">
        <Button size="lg" onClick={() => void confirm()} disabled={!amountMinor || (transaction.currency === "USD" && !amountCopMinor)}>Confirmar movimiento</Button>
        <Button variant="ghost" className="discard-button" onClick={() => void review({ importId: item._id, action: "discard" }).then(() => toast.success("Importación descartada."))}>Descartar</Button>
        <small><LockKeyhole /> Recibido automáticamente por Shortcut</small>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="detail-row"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div><b>›</b></div>;
}
