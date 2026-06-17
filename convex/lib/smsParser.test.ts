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
  incomingTransferAmountFirst:
    "Bancolombia: Recibiste una transferencia por $70,400 de MARIA SALAZAR en tu cuenta **7181, el 14/06/2026 a las 19:40. Si tienes dudas, hablemos: 018000931987. Siempre a tu lado.",
  incomingSmallKeyTransfer:
    "Bancolombia: David, recibiste una transferencia de SUSANA COSSIO SALAZAR por $5.00 en tu cuenta *7181 conectada a la llave @cossio781 el 14/06/26 a las 21:20. Con llaves es de una y gratis. Dudas al 018000912345",
  outgoingKeyTransfer:
    "Bancolombia: DAVID, transferiste $1,000.00 a la llave 1037662972 desde tu cuenta *7181 a SUSANA COSSIO SALAZAR el 14/06/26 a las 17:56. Con Bre-b es de una y gratis. Dudas al 018000912345.",
  outgoingSmallTransfer:
    "Bancolombia: Transferiste $1,000 desde tu cuenta *7181 a la cuenta *37927414369 el 15/06/2026 a las 17:36. ¿Dudas? Llamanos al 018000931987. Estamos cerca.",
  withdrawal:
    "Bancolombia: Retiraste $20.000,00 en MALLVERONA1 de tu T.Deb **6308 el 03/06/2026 a las 22:38. Si tienes dudas, llamanos al 6045109095. Estamos cerca.",
};

describe("parseMoneyToMinor", () => {
  it.each([
    ["16,000", "COP", 1_600_000],
    ["5.200,00", "COP", 520_000],
    ["875,452.00", "COP", 87_545_200],
    ["70,400", "COP", 7_040_000],
    ["1,000", "COP", 100_000],
    ["1,000.00", "COP", 100_000],
    ["5.00", "COP", 500],
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

  it("parses amount-first incoming transfers", () => {
    expect(parseBancolombiaSms(messages.incomingTransferAmountFirst)).toMatchObject({
      rule: "incoming_transfer",
      type: "income",
      status: "confirmed",
      currency: "COP",
      amountMinor: 7_040_000,
      amountCopMinor: 7_040_000,
      merchant: "MARIA SALAZAR",
      accountLabel: "cuenta **7181",
    });
  });

  it("parses small COP transfers that include cents", () => {
    expect(parseBancolombiaSms(messages.incomingSmallKeyTransfer)).toMatchObject({
      rule: "incoming_transfer",
      type: "income",
      status: "confirmed",
      amountMinor: 500,
      amountCopMinor: 500,
      merchant: "SUSANA COSSIO SALAZAR",
    });
  });

  it("handles 2-digit year in date", () => {
    const parsed = parseBancolombiaSms(messages.incomingTransfer);
    expect(parsed.occurredAt).toBe(Date.UTC(2026, 5, 14, 22, 42));
  });

  it("parses small account transfers with thousands separators", () => {
    expect(parseBancolombiaSms(messages.outgoingSmallTransfer)).toMatchObject({
      rule: "transfer",
      type: "expense",
      status: "confirmed",
      currency: "COP",
      amountMinor: 100_000,
      amountCopMinor: 100_000,
      merchant: "Transferencia a *37927414369",
    });
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

  it.each([
    [
      "Bancolombia: Compraste $12.900,00 en TOMO SANTA MARTA SAL con tu T.Deb *6308, el 13/06/2026 a las 11:43. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.",
      "purchase_cop",
      "expense",
      1_290_000,
      "TOMO SANTA MARTA SAL",
    ],
    [
      "Bancolombia: Compraste $70.450,00 en RAPPI COLOMBIA*DL con tu T.Deb *6308, el 14/06/2026 a las 19:38. Si tienes dudas, encuentranos aqui: 6045109095 o 018000931987. Estamos cerca.",
      "purchase_cop",
      "expense",
      7_045_000,
      "RAPPI COLOMBIA*DL",
    ],
    [
      "Bancolombia: Recibiste una transferencia por $1,000 de ISABELLA PALACIO en tu cuenta **7181, el 16/06/2026 a las 13:38. Si tienes dudas, hablemos: 018000931987. Siempre a tu lado.",
      "incoming_transfer",
      "income",
      100_000,
      "ISABELLA PALACIO",
    ],
    [
      "Bancolombia: Recibiste un pago de Nomina de HERCOSSIOS S.A. por $1,875,452.00 en tu cuenta de Ahorros el 15/06/2026 a las 08:31. Si tienes dudas, llamanos al 018000931987. A tu lado siempre.",
      "payroll",
      "income",
      187_545_200,
      "HERCOSSIOS S.A.",
    ],
    [
      "Bancolombia: David, recibiste una transferencia de SUSANA COSSIO SALAZAR por $138,800.00 en tu cuenta *7181 conectada a la llave @cossio781 el 16/06/26 a las 18:38. Con llaves es de una y gratis. Dudas al 018000912345",
      "incoming_transfer",
      "income",
      13_880_000,
      "SUSANA COSSIO SALAZAR",
    ],
    [
      "Bancolombia: Transferiste $1,000 desde tu cuenta *7181 a la cuenta *66341246261 el 16/06/2026 a las 18:43. ¿Dudas? Llamanos al 018000931987. Estamos cerca.",
      "transfer",
      "expense",
      100_000,
      "Transferencia a *66341246261",
    ],
  ] as const)("parses recent example %#", (message, rule, type, amountMinor, merchant) => {
    expect(parseBancolombiaSms(message)).toMatchObject({
      matched: true,
      rule,
      type,
      status: "confirmed",
      currency: "COP",
      amountMinor,
      amountCopMinor: amountMinor,
      merchant,
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
