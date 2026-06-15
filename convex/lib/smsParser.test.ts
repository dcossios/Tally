import { describe, expect, it } from "vitest";
import { parseBancolombiaSms, parseMoneyToMinor } from "./smsParser";

const messages = {
  transfer:
    "Bancolombia: Transferiste $16,000 desde tu cuenta *7181 a la cuenta *01700001523 el 14/06/2026 a las 10:57. ¿Dudas? Llamanos al 018000931987. Estamos cerca.",
  usd:
    "Bancolombia: Compraste USD17,18 en HETZNER ONLINE GMBH, el 03/06/2026 a las 20:57. Esta compra esta asociada a T.Cred *9347. Si tienes dudas, encuentranos aqui: 01800931987. Siempre contigo.",
  hotel:
    "Bancolombia: Compraste $5.200,00 en HOTEL ZUANA BEACH RE con tu T.Deb *6308, el 11/06/2026 a las 08:40. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.",
  restaurant:
    "Bancolombia: Compraste $4.900,00 en EXQUI SANTA M TA SAL con tu T.Deb *6308, el 13/06/2026 a las 11:49. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.",
  payroll:
    "Bancolombia: Recibiste un pago de Nomina de HERCOSSIOS S.A. por $875,452.00 en tu cuenta de Ahorros el 29/05/2026 a las 16:50. Si tienes dudas, llamanos al 018000931987. A tu lado siempre.",
  incomingTransfer:
    "Bancolombia: David, recibiste una transferencia de SUSANA COSSIO SALAZAR por $1,000.00 en tu cuenta *7181 conectada a la llave @cossio781 el 14/06/26 a las 17:42. Con llaves es de una y gratis. Dudas al 018000912345.",
  outgoingKeyTransfer:
    "Bancolombia: DAVID, transferiste $1,000.00 a la llave 1037662972 desde tu cuenta *7181 a SUSANA COSSIO SALAZAR el 14/06/26 a las 17:56. Con Bre-b es de una y gratis. Dudas al 018000912345.",
  outgoingAliasTransfer:
    "Bancolombia: DAVID, transferiste $12.00 a la llave @dco781 desde tu cuenta *7181 a David Cossio el 14/06/26 a las 20:02. Con Bre-b es de una y gratis. Dudas al 018000912345.",
  withdrawal:
    "Bancolombia: Retiraste $20.000,00 en MALLVERONA1 de tu T.Deb **6308 el 03/06/2026 a las 22:38. Si tienes dudas, llamanos al 6045109095. Estamos cerca.",
};

describe("parseMoneyToMinor", () => {
  it.each([
    ["16,000", "COP", 1_600_000],
    ["5.200,00", "COP", 520_000],
    ["875,452.00", "COP", 87_545_200],
    ["17,18", "USD", 1_718],
  ] as const)("parses %s %s", (value, currency, expected) => {
    expect(parseMoneyToMinor(value, currency)).toBe(expected);
  });
});

describe("parseBancolombiaSms", () => {
  it("parses a transfer as a confirmed COP expense", () => {
    const parsed = parseBancolombiaSms(messages.transfer);
    expect(parsed).toMatchObject({
      rule: "transfer",
      type: "expense",
      status: "confirmed",
      amountMinor: 1_600_000,
      merchant: "Transferencia a *01700001523",
    });
  });

  it("keeps USD purchases pending", () => {
    expect(parseBancolombiaSms(messages.usd)).toMatchObject({
      rule: "purchase_usd",
      currency: "USD",
      amountMinor: 1_718,
      status: "pending",
      merchant: "HETZNER ONLINE GMBH",
    });
  });

  it.each([
    [messages.hotel, 520_000, "HOTEL ZUANA BEACH RE"],
    [messages.restaurant, 490_000, "EXQUI SANTA M TA SAL"],
  ])("parses COP purchases", (message, amountMinor, merchant) => {
    expect(parseBancolombiaSms(message)).toMatchObject({
      rule: "purchase_cop",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant,
      status: "confirmed",
    });
  });

  it("parses payroll as income", () => {
    expect(parseBancolombiaSms(messages.payroll)).toMatchObject({
      rule: "payroll",
      type: "income",
      amountMinor: 87_545_200,
      merchant: "HERCOSSIOS S.A.",
      categoryName: "Nómina",
    });
  });

  it("tolerates repeated whitespace and missing accents", () => {
    const varied = messages.payroll.replace(/\s+/g, "   ").replace("Nomina", "Nómina");
    expect(parseBancolombiaSms(varied).rule).toBe("payroll");
  });

  it("parses incoming transfer as confirmed COP income", () => {
    expect(parseBancolombiaSms(messages.incomingTransfer)).toMatchObject({
      rule: "incoming_transfer",
      type: "income",
      status: "confirmed",
      currency: "COP",
      amountMinor: 100_000,
      amountCopMinor: 100_000,
      merchant: "SUSANA COSSIO SALAZAR",
      categoryName: "Transferencias",
    });
  });

  it("handles 2-digit year in date", () => {
    const parsed = parseBancolombiaSms(messages.incomingTransfer);
    expect(parsed.occurredAt).toBe(Date.UTC(2026, 5, 14, 22, 42));
  });

  it("parses outgoing key transfer as confirmed COP expense", () => {
    expect(parseBancolombiaSms(messages.outgoingKeyTransfer)).toMatchObject({
      rule: "transfer",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor: 100_000,
      amountCopMinor: 100_000,
      merchant: "SUSANA COSSIO SALAZAR",
      categoryName: "Transferencias",
      accountLabel: "Cuenta *7181 · Llave 1037662972",
    });
  });

  it("parses outgoing key transfers that use an alias handle", () => {
    expect(parseBancolombiaSms(messages.outgoingAliasTransfer)).toMatchObject({
      rule: "transfer",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor: 120000,
      amountCopMinor: 120000,
      merchant: "David Cossio",
      categoryName: "Transferencias",
      accountLabel: "Cuenta *7181 · Llave @dco781",
    });
  });

  it("parses ATM withdrawal as confirmed COP expense", () => {
    expect(parseBancolombiaSms(messages.withdrawal)).toMatchObject({
      rule: "withdrawal",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor: 2_000_000,
      amountCopMinor: 2_000_000,
      merchant: "MALLVERONA1",
      categoryName: "Retiros",
    });
  });

  it("returns unknown for unsupported messages", () => {
    expect(parseBancolombiaSms("Bancolombia: mensaje informativo")).toMatchObject({
      matched: false,
      rule: "unknown",
      status: "pending",
    });
  });
});
