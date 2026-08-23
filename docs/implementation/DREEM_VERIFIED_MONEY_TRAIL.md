# DREEM Verified Money Trail

## Governing rule

A payment is complete only when the obligation, collection proof, receipt, payer acknowledgement, custody or provider settlement and reconciliation form one verifiable chain.

## Financial states

| State | Meaning | Authority |
|---|---|---|
| Due | Learner has an open institutional obligation | Approved fee account |
| Referenced | Unique payment identity created for learner, payer, amount and allowed rails | Finance command |
| Collected | Bursar recorded cash or a provider-confirmed reference | Protected payment command |
| Credited | Learner balance was reduced atomically with receipt creation | Database transaction |
| Acknowledged | Payer confirmed or disputed the receipt | Opaque confirmation token |
| In custody | Cash is held by the named cashier and session | Cashier session |
| Counted | Cashier declared physical cash and submitted evidence | Session closure command |
| Reviewed | Different authorised person approved or rejected the variance | Accountant/leadership command |
| Deposited | Approved cash was submitted to an enabled institutional rail | Deposit batch |
| Reconciled | Independent reviewer matched deposit proof and collections | Settlement review command |

## Provider policy

Wave is assigned the best initial digital priority because the desired experience is simple and transparent. It is still an adapter, not DREEM's source of truth. MTN MoMo, Orange Money, bank/merchant accounts and later fintechs use the same stable payment contract.

No rail is enabled until the school establishes the relevant institutional merchant account and its configuration is reviewed. Provider secrets must remain server-side; the public client stores neither secret keys nor authoritative balances.

## Human authority

AI may explain anomalies, draft reminders and propose follow-up. It may not authoritatively change balances, approve reconciliation, decide waivers or conceal financial exceptions.
