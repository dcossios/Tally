## ADDED Requirements

### Requirement: Parse product payment messages as expenses
The system SHALL parse Bancolombia messages in the form `Pagaste <monto> a <destino> desde tu producto <cuenta> el <fecha> <hora>` as confirmed expense transactions.

#### Scenario: Product payment is imported
- **WHEN** an SMS states that the user paid a recipient from a Bancolombia product and includes amount, destination, and timestamp
- **THEN** the system creates a confirmed expense transaction with the parsed amount, destination, account reference, and occurrence time

### Requirement: Parse QR payment messages as expenses
The system SHALL parse Bancolombia messages in the form `pagaste <monto> por codigo QR ...` as confirmed expense transactions.

#### Scenario: QR payment is imported
- **WHEN** an SMS states that the user paid an amount by QR from a Bancolombia account and includes timestamp data
- **THEN** the system creates a confirmed expense transaction with the parsed amount, QR counterparty reference, and occurrence time

### Requirement: Parse supplier payment receipts as income
The system SHALL parse Bancolombia messages in the form `Recibiste un pago proveedor de <origen> por <monto> ...` as confirmed income transactions.

#### Scenario: Supplier payment is imported
- **WHEN** an SMS states that the user received a supplier payment with source, amount, and timestamp
- **THEN** the system creates a confirmed income transaction with the parsed amount, source, and occurrence time

### Requirement: Ignore rejected suspicious transfer alerts
The system MUST NOT create a transaction for a Bancolombia message that explicitly says a suspicious transfer was rejected.

#### Scenario: Rejected suspicious transfer alert arrives
- **WHEN** an SMS states that Bancolombia rejected a suspicious transfer attempt for security reasons
- **THEN** the import flow records no transaction for that alert

### Requirement: Accept visible Bancolombia date variants
The system SHALL parse supported Bancolombia messages when their timestamps use either `el <date> a las <time>` or `el <date> <time[:seconds]>`.

#### Scenario: Date includes a las
- **WHEN** a supported SMS includes `el 20/06/2026 a las 16:42`
- **THEN** the system extracts the correct occurrence time

#### Scenario: Date omits a las and includes seconds
- **WHEN** a supported SMS includes `el 17/06/2026 13:34:15`
- **THEN** the system extracts the correct occurrence time without requiring manual review
