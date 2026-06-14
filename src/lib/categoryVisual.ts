export type CategoryVisual = { emoji: string; bg: string };

const MAP: Record<string, CategoryVisual> = {
  Compras: { emoji: "🛍️", bg: "#caa15a" },
  Transferencias: { emoji: "🔄", bg: "#5a8fd6" },
  "Servicios digitales": { emoji: "💻", bg: "#9a7fd6" },
  Vivienda: { emoji: "🏠", bg: "#d67f9a" },
  Transporte: { emoji: "🚝", bg: "#e08d6f" },
  Nómina: { emoji: "💼", bg: "#5fae7e" },
  "Otros ingresos": { emoji: "🤑", bg: "#4fae9e" },
};

const FALLBACK: Record<"expense" | "income", CategoryVisual> = {
  expense: { emoji: "💳", bg: "#6b7280" },
  income: { emoji: "💰", bg: "#5fae7e" },
};

export function categoryVisual(
  name: string | undefined,
  type: "expense" | "income" = "expense",
): CategoryVisual {
  if (name && MAP[name]) return MAP[name];
  return FALLBACK[type];
}
