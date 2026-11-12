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

/** "$2.000.000 + USD 500,00 (a $4.100)"; sin pesos, solo la parte en dólares. */
export function formatOpeningBreakdown(
  copMinor: number,
  usdMinor: number,
  usdRateCopMinor: number,
) {
  // Espacios duros: si no cabe en una línea, solo se parte entre el monto y la tasa.
  const nbsp = " ";
  const hard = (text: string) => text.replace(/ /g, nbsp);
  const usd = `${hard(formatMoney(usdMinor, "USD"))} ${hard(`(a ${formatMoney(usdRateCopMinor)})`)}`;
  return copMinor === 0 ? usd : `${hard(`${formatMoney(copMinor)} +`)} ${usd}`;
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
