export function formatMoney(
  minor: number,
  currency: "COP" | "USD" = "COP",
  sign?: "positive" | "negative",
) {
  if (currency === "USD") {
    const amount = new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(minor) / 100);
    const prefix = sign === "positive" ? "+" : sign === "negative" ? "−" : "";
    return `${prefix}USD ${amount}`;
  }
  const amount = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(minor) / 100);
  if (sign === "positive") return `+${amount}`;
  if (sign === "negative") return `−${amount}`;
  return amount;
}

export function formatDate(timestamp: number, long = false) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
  }).format(timestamp);
}

export function toDateInput(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function dateInputToBogota(value: string) {
  return Date.parse(`${value}T12:00:00-05:00`);
}

export function periodOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
