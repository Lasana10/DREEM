#!/usr/bin/env python3
"""Fail-closed guard for the dedicated DREEM PTA production migration.

Reads the output of `supabase migration list --linked` via stdin.
Only authorises a db push when the expected PTA migration is the sole
local-only migration and remote history has no remote-only entries.
"""
import re
import sys

EXPECTED = "20261026150000"
pending = []
remote_only = []
matched = 0
for line in sys.stdin:
    cols = re.split(r"[│|]", line)
    if len(cols) < 2:
        continue
    local = cols[0].strip()
    remote = cols[1].strip()
    if not local and not remote:
        continue
    if not (re.fullmatch(r"\d{14}", local) or re.fullmatch(r"\d{14}", remote)):
        continue
    matched += 1
    if re.fullmatch(r"\d{14}", local) and not remote:
        pending.append(local)
    if not local and re.fullmatch(r"\d{14}", remote):
        remote_only.append(remote)

if not matched:
    sys.exit("Refusing database push: migration list was empty or unreadable.")
if remote_only:
    sys.exit("Refusing database push: remote-only migration history requires manual reconciliation.")
if pending != [EXPECTED]:
    sys.exit("Refusing database push: pending migrations do not consist solely of DREEM PTA " + EXPECTED + ". Pending: " + ", ".join(pending))
print("Approved: only DREEM PTA migration " + EXPECTED + " is pending.")
