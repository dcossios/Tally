## Why

The current SMS parser is brittle against common Bancolombia message variants and incorrectly treats unsupported messages as pending expenses. This creates noisy review items and misses real income and expense movements that are already visible in incoming notifications.

## What Changes

- Add support for Bancolombia `Pagaste ... desde tu producto ...` payment messages as confirmed expenses.
- Add support for Bancolombia `pagaste ... por codigo QR ...` messages as confirmed expenses.
- Add support for Bancolombia `Recibiste un pago proveedor ...` messages as confirmed income.
- Detect rejected suspicious transfer alerts and ignore them instead of creating pending expense records.
- Relax date parsing so supported messages still parse when Bancolombia omits `a las` or includes seconds.

## Capabilities

### New Capabilities
- `sms-import-parsing`: Parse supported bank SMS variants into the correct transaction outcome, including ignored non-movement alerts.

### Modified Capabilities

## Impact

- Affected code: `convex/lib/smsParser.ts`, `convex/lib/smsParser.test.ts`, and the SMS import flow in `convex/imports.ts`.
- Affected behavior: automatic import classification for incoming SMS notifications and pending review volume.
- No new dependencies or external services are required.
