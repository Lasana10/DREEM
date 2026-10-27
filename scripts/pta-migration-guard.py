#!/usr/bin/env python3
"""Fail-closed production guard for DREEM PTA's two ordered migrations.

Accepts only:
  * the original PTA migration and family-intake migration both pending; or
  * the original migration already deployed, with only family intake pending.

Never silently pushes unrelated local migrations or rewrites remote-only history.
"""
import re
import sys

BASE = "20261026150000"
FAMILY = "20261027120000"
ALLOWED_PENDING = ([BASE, FAMILY], [FAMILY])
pending = []
remote_only = []
remote_versions = set()
matched = 0

for line in sys.stdin:
    cols = re.split(r"[│|]", line)
    if len(cols) < 2:
        continue
    local, remote = (col.strip() for col in cols[:2])
    is_local = bool(re.fullmatch(r"\d{14}", local))
    is_remote = bool(re.fullmatch(r"\d{14}", remote))
    if not (is_local or is_remote):
        continue
    matched += 1
    if is_local and is_remote and local != remote:
        sys.exit("Refusing database push: migration versions disagree.")
    if is_remote:
        remote_versions.add(remote)
    if is_local and not is_remote:
        pending.append(local)
    if is_remote and not is_local:
        remote_only.append(remote)

if not matched:
    sys.exit("Refusing database push: migration list was empty or unreadable.")
if remote_only:
    sys.exit("Refusing database push: remote-only migration history requires reconciliation.")
if pending not in ALLOWED_PENDING:
    sys.exit("Refusing database push: expected only ordered DREEM PTA migrations; pending: " + ", ".join(pending))
if pending == [FAMILY] and BASE not in remote_versions:
    sys.exit("Refusing database push: base PTA migration has not been deployed.")
print("Approved PTA schema migrations: " + ", ".join(pending))
