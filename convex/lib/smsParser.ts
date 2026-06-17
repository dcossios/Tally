export type ParsedSms = {
  matched: boolean;
  rule:
    | "transfer"
    | "incoming_transfer"
    | "withdrawal"
    | "purchase_cop"
    | "purchase_usd"
    | "payroll"
    | "unknown";
  type: "expense" | "income";
  status: "confirmed" | "pending";
  currency: "COP" | "USD";
  amountMinor: number;
  amountCopMinor?: number;
  merchant: string;
  categoryName: string;
  occurredAt: number;
  accountLabel?: string;
  error?: string;
};

const MONTH_OFFSET = 1;
const BOGOTA_UTC_OFFSET_HOURS = 5;

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMoneyToMinor(
  rawValue: string,
  currency: "COP" | "USD",
): number {
  const value = rawValue.replace(/\s/g, "");
  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");
  const decimalIndex = Math.max(lastDot, lastComma);
  let integerPart = value;
  let decimalPart = "";

  if (decimalIndex >= 0) {
    const digitsAfter = value.length - decimalIndex - 1;
    const hasBothSeparators = lastDot >= 0 && lastComma >= 0;
    const hasSingleSeparator = !hasBothSeparators;
    const shouldUseDecimals =
      digitsAfter === 2 &&
      (hasBothSeparators || currency === "USD" || hasSingleSeparator);

    if (shouldUseDecimals) {
      integerPart = value.slice(0, decimalIndex);
      decimalPart = value.slice(decimalIndex + 1);
    }
  }

  const whole = Number.parseInt(integerPart.replace(/[.,]/g, ""), 10);
  const cents = decimalPart
    ? Number.parseInt(decimalPart.padEnd(2, "0").slice(0, 2), 10)
    : 0;

  if (!Number.isFinite(whole) || !Number.isFinite(cents)) {
    throw new Error(`Monto inválido: ${rawValue}`);
  }
  return whole * 100 + cents;
}

function parseBogotaDate(message: string): number | null {
  const match = message.match(
    /el\s+(\d{2})\/(\d{2})\/(\d{2,4})\s+a\s+las\s+(\d{2}):(\d{2})/i,
  );
  if (!match) return null;
  const [, day, month, rawYear, hour, minute] = match;
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  return Date.UTC(
    year,
    Number(month) - MONTH_OFFSET,
    Number(day),
    Number(hour) + BOGOTA_UTC_OFFSET_HOURS,
    Number(minute),
  );
}

function extractAccount(message: string): string | undefined {
  const match = message.match(
    /(T\.(?:Cred|Deb)\s+\*+\d+|cuenta\s+\*+\d+)/i,
  );
  return match?.[1]?.replace(/\s+/g, " ");
}

export function parseBancolombiaSms(message: string): ParsedSms {
  const normalized = normalizeForMatch(message);
  const occurredAt = parseBogotaDate(normalized);
  if (occurredAt === null) {
    return unknown("No se encontró una fecha válida.");
  }

  const transfer = normalized.match(
    /Transferiste\s+\$([\d.,]+)\s+desde.+?\s+a\s+la\s+cuenta\s+(\*\d+)/i,
  );
  if (transfer) {
    return {
      matched: true,
      rule: "transfer",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor: parseMoneyToMinor(transfer[1], "COP"),
      amountCopMinor: parseMoneyToMinor(transfer[1], "COP"),
      merchant: `Transferencia a ${transfer[2]}`,
      categoryName: "Transferencias",
      occurredAt,
      accountLabel: extractAccount(normalized),
    };
  }

  const brebTransfer = normalized.match(
    /(?:[A-Z]+,\s+)?transferiste\s+\$([\d.,]+)\s+a\s+la\s+llave\s+([^\s]+)\s+desde\s+tu\s+cuenta\s+(\*\d+)\s+a\s+(.+?)\s+el\s+/i,
  );
  if (brebTransfer) {
    const amountMinor = parseMoneyToMinor(brebTransfer[1], "COP");
    return {
      matched: true,
      rule: "transfer",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant: brebTransfer[4].trim(),
      categoryName: "Transferencias",
      occurredAt,
      accountLabel: `Cuenta ${brebTransfer[3]} · Llave ${brebTransfer[2]}`,
    };
  }

  const usdPurchase = normalized.match(
    /Compraste\s+USD\s?([\d.,]+)\s+en\s+(.+?),\s+el\s+/i,
  );
  if (usdPurchase) {
    return {
      matched: true,
      rule: "purchase_usd",
      type: "expense",
      status: "pending",
      currency: "USD",
      amountMinor: parseMoneyToMinor(usdPurchase[1], "USD"),
      merchant: usdPurchase[2].trim(),
      categoryName: "Servicios digitales",
      occurredAt,
      accountLabel: extractAccount(normalized),
    };
  }

  const copPurchase = normalized.match(
    /Compraste\s+\$([\d.,]+)\s+en\s+(.+?)\s+con\s+tu\s+T\.(?:Cred|Deb)/i,
  );
  if (copPurchase) {
    const amountMinor = parseMoneyToMinor(copPurchase[1], "COP");
    return {
      matched: true,
      rule: "purchase_cop",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant: copPurchase[2].trim(),
      categoryName: "Compras",
      occurredAt,
      accountLabel: extractAccount(normalized),
    };
  }

  const payroll = normalized.match(
    /Recibiste\s+un\s+pago\s+de\s+Nomina\s+de\s+(.+?)\s+por\s+\$([\d.,]+)/i,
  );
  if (payroll) {
    const amountMinor = parseMoneyToMinor(payroll[2], "COP");
    return {
      matched: true,
      rule: "payroll",
      type: "income",
      status: "confirmed",
      currency: "COP",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant: payroll[1].trim(),
      categoryName: "Nómina",
      occurredAt,
      accountLabel: "Cuenta de Ahorros",
    };
  }

  const incomingTransfer = normalized.match(
    /recibiste\s+una\s+transferencia\s+de\s+(.+?)\s+por\s+\$([\d.,]+)/i,
  );
  if (incomingTransfer) {
    const amountMinor = parseMoneyToMinor(incomingTransfer[2], "COP");
    return {
      matched: true,
      rule: "incoming_transfer",
      type: "income",
      status: "confirmed",
      currency: "COP",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant: incomingTransfer[1].trim(),
      categoryName: "Transferencias",
      occurredAt,
      accountLabel: extractAccount(normalized),
    };
  }

  const incomingTransferAmountFirst = normalized.match(
    /recibiste\s+una\s+transferencia\s+por\s+\$([\d.,]+)\s+de\s+(.+?)\s+en\s+tu\s+cuenta/i,
  );
  if (incomingTransferAmountFirst) {
    const amountMinor = parseMoneyToMinor(incomingTransferAmountFirst[1], "COP");
    return {
      matched: true,
      rule: "incoming_transfer",
      type: "income",
      status: "confirmed",
      currency: "COP",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant: incomingTransferAmountFirst[2].trim(),
      categoryName: "Transferencias",
      occurredAt,
      accountLabel: extractAccount(normalized),
    };
  }

  const withdrawal = normalized.match(
    /Retiraste\s+\$([\d.,]+)\s+en\s+(.+?)\s+de\s+tu\s+T\.Deb/i,
  );
  if (withdrawal) {
    const amountMinor = parseMoneyToMinor(withdrawal[1], "COP");
    return {
      matched: true,
      rule: "withdrawal",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant: withdrawal[2].trim(),
      categoryName: "Retiros",
      occurredAt,
      accountLabel: extractAccount(normalized),
    };
  }

  return unknown("El formato del mensaje todavía no está soportado.", occurredAt);
}

function unknown(error: string, occurredAt = Date.now()): ParsedSms {
  return {
    matched: false,
    rule: "unknown",
    type: "expense",
    status: "pending",
    currency: "COP",
    amountMinor: 0,
    merchant: "Movimiento por revisar",
    categoryName: "Sin categoría",
    occurredAt,
    error,
  };
}
