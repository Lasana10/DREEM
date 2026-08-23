# DREEM first vertical slice

The first-school slice is certified only when all stages below pass with real persisted records and the correct accounts.

1. Allowlisted founder activates an account.
2. Founder creates the first school.
3. Founder configures identity, academic year, terms, classes, subjects and finance rails.
4. Founder invites an administrator, bursar, accountant and teacher.
5. Each staff member activates access; unauthorised roles are denied.
6. Administrator enrols a learner and links the guardian.
7. DREEM creates the learner credential and open fee account.
8. Bursar creates a unique payment reference.
9. A controlled cash payment records a receipt, updates the fee balance and queues the parent confirmation.
10. Parent confirms or disputes the receipt through the opaque confirmation token.
11. Bursar submits the cashier session with physical count evidence.
12. Accountant—not the collector—approves or rejects the reconciliation.
13. Bursar deposits approved cash into an enabled institutional rail.
14. Accountant independently confirms the deposit and DREEM marks the constituent payments reconciled.
15. A controlled digital payment repeats steps 8–10 using an enabled provider rail and unique provider reference.
16. Teacher records attendance and assessment evidence for the same learner.
17. Leadership sees the learner, fee, attendance, assessment, confirmation, custody and settlement positions in one command view.

## Mandatory negative tests

- Anonymous school bootstrap is denied.
- Cross-school records are invisible and unmodifiable.
- Teacher cannot collect or reconcile payments.
- Bursar cannot approve their own cashier closure or deposit batch.
- Cash cannot be recorded without an open cashier session.
- Digital payment cannot be recorded without an enabled rail and provider reference.
- Duplicate idempotency and provider references do not create duplicate receipts.
- Overpayment is rejected.
- Payment and event deletion is rejected; correction uses reversal.
- Offline replay cannot double-credit the learner account.

## Evidence pack

The certification pack must retain test-account roles, timestamps, payment and receipt references, screenshots, database assertions, RLS denials, outbox delivery results, reconciliation evidence and recovery/retry results. No production secrets or complete payer phone numbers belong in the pack.
