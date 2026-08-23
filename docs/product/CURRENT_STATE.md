# DREEM current state

Updated: 23 August 2026

## Production baseline

- Dedicated repository: `Lasana10/DREEM`
- Production branch: `main`
- Last confirmed remote baseline before this work: `87ef0c7`
- Supabase project: `vlukkucwtfmfgpzvjyvd`
- The earlier 11 DREEM migrations were reported applied.
- Dedicated Cloudflare production deployment is still not independently verified.
- Founder activation and the first real school bootstrap are still pending.

## Implemented in this working change

`DREEM-FINANCE-001` now has a coherent Verified Money Trail implementation:

- concrete membership roles now satisfy the earlier `leadership` and `support` capability policies;
- legacy fee-account columns and statuses are normalized;
- each collection begins with a unique learner payment reference;
- Wave, MTN MoMo, Orange Money, bank, cash, card and cheque remain provider-neutral rails;
- Wave is the preferred initial digital rail by priority, but no provider is hard-wired;
- digital collections require a provider/merchant reference;
- cash requires a cashier-owned open session;
- receipt creation and learner fee-balance updates occur in one database transaction;
- cash remains visible as custody until independent session review and deposit confirmation;
- payer confirmation/dispute tokens are created without exposing learner information publicly;
- provider notifications are emitted through the existing durable domain-event outbox;
- cashier closure and cash-deposit confirmation enforce separation of duties;
- payment, receipt and reconciliation evidence is append-only; corrections remain reversal-based.

## Verification completed locally

- ESLint passed with zero warnings.
- 11 domain tests passed.
- TypeScript project build passed.
- Vite production build passed.
- Supabase migration `20260823191105_verified_money_trail` applied successfully to project `vlukkucwtfmfgpzvjyvd`.
- Supabase migration `20260823191222_verified_money_trail_policy_cleanup` applied successfully.
- Live privilege verification confirms the legacy payment RPC is no longer executable by authenticated clients and the verified payment RPC is executable.

## Not yet production-proven

- Payment rails do not become operational merely by appearing in the interface. A school must establish and configure its merchant account, then enable that rail.
- Actual Wave/MTN/Orange/bank webhook authenticity and settlement callbacks still require provider credentials and sandbox/live-provider testing.
- SMS/WhatsApp delivery still requires a configured messaging provider and delivery worker.
- Cashier closure, independent review and deposit batching are implemented at database-command level; dedicated review screens remain to be completed.
- No real founder, school, bursar, accountant, learner or guardian account has yet completed the full finance journey.

The feature must not be described as production-certified until the first-school operational test records and independently reconciles real controlled test payments across the intended roles.
