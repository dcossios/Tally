import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dateInputToBogota, toDateInput } from "@/lib/format";
import type { Doc } from "../../convex/_generated/dataModel";

export function TransactionDialog({ open, onOpenChange, transaction }: { open: boolean; onOpenChange: (open: boolean) => void; transaction?: Doc<"transactions"> }) {
  const create = useMutation(api.transactions.create);
  const update = useMutation(api.transactions.update);
  const remove = useMutation(api.transactions.remove);
  const [type, setType] = useState<"expense" | "income">(transaction?.type ?? "expense");
  const categories = useQuery(api.categories.list, { kind: type });
  useEffect(() => {
    setType(transaction?.type ?? "expense");
  }, [transaction]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="transaction-dialog" key={transaction?._id ?? "new"}>
        <DialogHeader><DialogTitle>{transaction ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle><DialogDescription>{transaction ? "Actualiza o elimina este registro." : "Registra un ingreso o gasto manual."}</DialogDescription></DialogHeader>
        <form
          className="movement-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const amountMinor = Math.round(Number(String(form.get("amount")).replace(/[^\d]/g, "")) * 100);
            const category = categories?.find((item) => item._id === form.get("categoryId"));
            const payload = {
              type,
              currency: transaction?.currency ?? ("COP" as const),
              amountMinor,
              amountCopMinor: transaction?.currency === "USD" ? transaction.amountCopMinor : amountMinor,
              merchant: String(form.get("merchant")),
              categoryId: category?._id,
              categoryName: category?.name ?? transaction?.categoryName ?? "Sin categoría",
              occurredAt: dateInputToBogota(String(form.get("date"))),
              accountLabel: transaction?.accountLabel,
              note: transaction?.note,
            };
            const request = transaction
              ? update({ id: transaction._id, ...payload })
              : create(payload);
            void request.then(() => {
              toast.success(transaction ? "Movimiento actualizado." : "Movimiento guardado.");
              onOpenChange(false);
            }).catch((error: Error) => toast.error(error.message));
          }}
        >
          <ToggleGroup type="single" value={type} onValueChange={(value) => value && setType(value as "expense" | "income")} className="type-toggle">
            <ToggleGroupItem value="expense">Gasto</ToggleGroupItem><ToggleGroupItem value="income">Ingreso</ToggleGroupItem>
          </ToggleGroup>
          <label>Monto en {transaction?.currency ?? "COP"}<Input name="amount" inputMode="numeric" placeholder="0" defaultValue={transaction ? Math.round(transaction.amountMinor / 100) : undefined} required /></label>
          <label>Comercio o descripción<Input name="merchant" defaultValue={transaction?.merchant} required /></label>
          <label>Categoría<select name="categoryId" defaultValue={transaction?.categoryId ?? ""}><option value="">{transaction?.categoryName ?? "Selecciona una categoría"}</option>{categories?.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
          <label>Fecha<Input name="date" type="date" defaultValue={toDateInput(transaction?.occurredAt ?? Date.now())} required /></label>
          <Button size="lg" type="submit">{transaction ? "Guardar cambios" : "Guardar movimiento"}</Button>
          {transaction ? <Button type="button" variant="ghost" className="discard-button" onClick={() => void remove({ id: transaction._id }).then(() => { toast.success("Movimiento eliminado."); onOpenChange(false); })}>Eliminar movimiento</Button> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
