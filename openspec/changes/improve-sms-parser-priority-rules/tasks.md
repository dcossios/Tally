## 1. Parser updates

- [x] 1.1 Extend `convex/lib/smsParser.ts` to parse `Pagaste ... desde tu producto ...` messages as confirmed expenses.
- [x] 1.2 Extend `convex/lib/smsParser.ts` to parse `pagaste ... por codigo QR ...` messages as confirmed expenses.
- [x] 1.3 Extend `convex/lib/smsParser.ts` to parse `Recibiste un pago proveedor ...` messages as confirmed income.
- [x] 1.4 Update date extraction in `convex/lib/smsParser.ts` to support `a las` and non-`a las` timestamp variants, including optional seconds.
- [x] 1.5 Update the import flow so rejected suspicious transfer alerts do not create pending expense transactions.

## 2. Verification

- [x] 2.1 Add parser fixtures and tests in `convex/lib/smsParser.test.ts` for each new supported message family.
- [x] 2.2 Add a regression test for rejected suspicious transfer alerts to verify no transaction is created by the import flow.
- [x] 2.3 Run the targeted parser/import test suite and confirm the new fixtures pass alongside existing ones.
