# DREEM requirements ledger

This ledger distinguishes vision, implementation, connection, verification and production proof.

| ID | Capability | Source patterns | DREEM adaptation / superiority | Current status | Production evidence required |
|---|---|---|---|---|---|
| DREEM-FINANCE-001 | Verified Money Trail | Mifos ledger discipline, Mojaloop interoperability, ERPNext/Odoo school finance, Wave-like simplicity | One traceable chain across obligation, payment identity, provider/cash proof, receipt, payer acknowledgement, custody, settlement and reconciliation | Implemented locally; quality gate passed | Migration applied; bursar/accountant/parent E2E; provider and cash reconciliation proof |
| DREEM-FINANCE-002 | Provider-neutral payment rails | Mojaloop and adapter architecture | Wave-preferred priority without vendor lock-in; MTN MoMo, Orange Money, bank, cash and later rails are interchangeable | Schema and command foundation implemented | Merchant configuration UI, signed provider webhooks, sandbox/live tests |
| DREEM-FINANCE-003 | Cash chain of custody | Ledger-grade cash-office controls | Collected, counted, reviewed, deposited and reconciled remain distinct states with separation of duties | Database commands implemented | Cashier closure/review screens and real two-person operational test |
| DREEM-FINANCE-004 | Parent payment witness | RapidPro/Glific/Novu-style messaging | Receipt confirmation or dispute becomes independent evidence; a message alone is never authoritative proof | Token and outbox event implemented | Delivery worker, language templates, acknowledgement link and real delivery evidence |
| DREEM-ACCESS-001 | Institution and role isolation | OpenEMIS/OpenG2P patterns plus PostgreSQL RLS | Database-enforced school isolation and concrete-role capability mapping | Earlier RLS plus role-alias correction implemented | RLS matrix test for every role and cross-school denial |
| DREEM-OFFLINE-001 | Offline-resilient operations | Kolibri and ODK patterns | Offline-safe commands, idempotency and later conflict resolution for weak-connectivity schools | Idempotency foundation present; full offline finance queue not complete | Disconnect/reconnect, duplicate replay and conflict tests |

## Status vocabulary

- **Vision:** agreed outcome only.
- **Implemented:** code/schema exists.
- **Connected:** required external infrastructure is configured.
- **Verified:** automated and role-based end-to-end tests pass.
- **Production-proven:** the live deployment completed the workflow with controlled real-world evidence.
