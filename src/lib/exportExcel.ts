import { toDateInput } from "@/lib/format";

type ExportTransaction = {
  id: string;
  type: "expense" | "income";
  status: "confirmed" | "pending";
  currency: "COP" | "USD";
  amountMinor: number;
  amountCopMinor: number | null;
  merchant: string;
  categoryName: string;
  occurredAt: number;
  accountLabel: string | null;
  note: string | null;
  source: "manual" | "sms";
};

type ExportWorkbookData = ExportTransaction[];

const COP_FORMAT = '"$"#,##0;[Red]-"$"#,##0';
const NUMBER_FORMAT = '#,##0.00';
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } } as const;
const INCOME_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2F1" } } as const;
const EXPENSE_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } } as const;
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } } as const;

export async function downloadTransactionsExcel(data: ExportWorkbookData, rangeLabel: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Saldo";
  workbook.created = new Date();
  workbook.modified = new Date();

  const ordered = [...data].sort((a, b) => a.occurredAt - b.occurredAt);
  const incomes = ordered.filter((transaction) => transaction.type === "income");
  const expenses = ordered.filter((transaction) => transaction.type === "expense");
  const summary = buildSummary(ordered);

  buildSummarySheet(workbook, summary);
  buildTransactionsSheet(workbook, "Movimientos", ordered, true);
  buildTransactionsSheet(workbook, "Ingresos", incomes, false);
  buildTransactionsSheet(workbook, "Gastos", expenses, false);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Saldo-export-${rangeLabel}-${toDateInput(Date.now())}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildSummary(transactions: ExportTransaction[]) {
  let incomeCop = 0;
  let expenseCop = 0;
  let pending = 0;

  for (const transaction of transactions) {
    if (transaction.status === "pending" || transaction.amountCopMinor === null) {
      pending += 1;
      continue;
    }
    if (transaction.type === "income") incomeCop += transaction.amountCopMinor;
    else expenseCop += transaction.amountCopMinor;
  }

  return {
    incomeCop: incomeCop / 100,
    expenseCop: expenseCop / 100,
    balanceCop: (incomeCop - expenseCop) / 100,
    transactionCount: transactions.length,
    incomeCount: transactions.filter((transaction) => transaction.type === "income").length,
    expenseCount: transactions.filter((transaction) => transaction.type === "expense").length,
    pendingCount: pending,
    firstDate: transactions[0]?.occurredAt ?? null,
    lastDate: transactions.at(-1)?.occurredAt ?? null,
  };
}

function buildSummarySheet(workbook: import("exceljs").Workbook, summary: ReturnType<typeof buildSummary>) {
  const sheet = workbook.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
  });

  sheet.columns = [
    { key: "label", width: 28 },
    { key: "value", width: 22 },
  ];

  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = "Balance general";
  sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 18 };
  sheet.getCell("A1").fill = HEADER_FILL;
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.getRow(1).height = 28;

  const rows: Array<[string, string | number]> = [
    ["Ingresos confirmados", summary.incomeCop],
    ["Gastos confirmados", summary.expenseCop],
    ["Balance", summary.balanceCop],
    ["Movimientos totales", summary.transactionCount],
    ["Ingresos registrados", summary.incomeCount],
    ["Gastos registrados", summary.expenseCount],
    ["Pendientes sin COP confirmado", summary.pendingCount],
    [
      "Rango",
      summary.firstDate && summary.lastDate
        ? `${formatDate(summary.firstDate)} a ${formatDate(summary.lastDate)}`
        : "Sin movimientos",
    ],
  ];

  sheet.addRows(rows);
  sheet.getColumn(1).font = { bold: true };
  sheet.getColumn(2).alignment = { horizontal: "right" };
  for (const rowNumber of [2, 3, 4]) {
    sheet.getCell(rowNumber, 2).numFmt = COP_FORMAT;
  }
  sheet.getCell("A4").fill = TOTAL_FILL;
  sheet.getCell("B4").fill = TOTAL_FILL;
  sheet.getCell("A4").font = { bold: true };
  sheet.getCell("B4").font = { bold: true };
  sheet.getCell("B4").font = {
    bold: true,
    color: { argb: summary.balanceCop >= 0 ? "FF0F766E" : "FFB91C1C" },
  };

  sheet.addRow([]);
  sheet.addRow(["Notas"]);
  sheet.addRow(["El balance solo suma movimientos confirmados con valor COP."]);
  sheet.addRow(["Los movimientos pendientes quedan en las hojas de detalle para revisión."]);
  sheet.getCell("A11").font = { bold: true };
  sheet.mergeCells("A12:B12");
  sheet.mergeCells("A13:B13");
}

function buildTransactionsSheet(
  workbook: import("exceljs").Workbook,
  name: string,
  transactions: ExportTransaction[],
  includeSignedColumn: boolean,
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const columns = [
    { header: "Fecha", key: "date", width: 14 },
    { header: "Tipo", key: "type", width: 12 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Categoría", key: "category", width: 22 },
    { header: "Comercio / origen", key: "merchant", width: 30 },
    { header: "Nota / detalle", key: "detail", width: 38 },
    { header: "Cuenta", key: "account", width: 16 },
    { header: "Moneda", key: "currency", width: 10 },
    { header: "Monto original", key: "originalAmount", width: 16 },
    { header: "Monto COP", key: "copAmount", width: 16 },
    ...(includeSignedColumn
      ? [{ header: "Impacto balance", key: "signedCopAmount", width: 18 }]
      : []),
    { header: "Fuente", key: "source", width: 12 },
  ];
  sheet.columns = columns;

  sheet.addRows(
    transactions.map((transaction) => {
      const copAmount = transaction.amountCopMinor === null ? null : transaction.amountCopMinor / 100;
      return {
        date: new Date(transaction.occurredAt),
        type: transaction.type === "income" ? "Ingreso" : "Gasto",
        status: transaction.status === "confirmed" ? "Confirmado" : "Pendiente",
        category: transaction.categoryName,
        merchant: transaction.merchant,
        detail: transaction.note?.trim() || transaction.merchant || transaction.categoryName,
        account: transaction.accountLabel ?? "",
        currency: transaction.currency,
        originalAmount: transaction.amountMinor / 100,
        copAmount,
        signedCopAmount:
          copAmount === null
            ? null
            : transaction.type === "income"
              ? copAmount
              : -copAmount,
        source: transaction.source === "sms" ? "SMS" : "Manual",
      };
    }),
  );

  styleHeader(sheet.getRow(1));
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  sheet.getColumn("date").numFmt = "yyyy-mm-dd";
  sheet.getColumn("originalAmount").numFmt = NUMBER_FORMAT;
  sheet.getColumn("copAmount").numFmt = COP_FORMAT;
  if (includeSignedColumn) sheet.getColumn("signedCopAmount").numFmt = COP_FORMAT;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const type = row.getCell(2).value;
    row.getCell(6).alignment = { wrapText: true, vertical: "top" };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });
    row.getCell(2).fill = type === "Ingreso" ? INCOME_FILL : EXPENSE_FILL;
  }

  const totalRowNumber = sheet.rowCount + 2;
  sheet.getCell(totalRowNumber, 9).value = "Total COP";
  sheet.getCell(totalRowNumber, 9).font = { bold: true };
  sheet.getCell(totalRowNumber, 10).value = {
    formula: `SUM(J2:J${Math.max(sheet.rowCount, 2)})`,
    result: transactions.reduce((sum, transaction) => sum + (transaction.amountCopMinor ?? 0) / 100, 0),
  };
  sheet.getCell(totalRowNumber, 10).numFmt = COP_FORMAT;
  sheet.getCell(totalRowNumber, 10).font = { bold: true };

  if (includeSignedColumn) {
    sheet.getCell(totalRowNumber + 1, 10).value = "Balance";
    sheet.getCell(totalRowNumber + 1, 10).font = { bold: true };
    sheet.getCell(totalRowNumber + 1, 11).value = {
      formula: `SUM(K2:K${Math.max(sheet.rowCount, 2)})`,
      result: transactions.reduce((sum, transaction) => {
        const amount = (transaction.amountCopMinor ?? 0) / 100;
        return sum + (transaction.type === "income" ? amount : -amount);
      }, 0),
    };
    sheet.getCell(totalRowNumber + 1, 11).numFmt = COP_FORMAT;
    sheet.getCell(totalRowNumber + 1, 11).font = { bold: true };
  }
}

function styleHeader(row: import("exceljs").Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(timestamp);
}
