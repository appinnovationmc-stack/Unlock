"""Build a fresh-install SQL stream without rewriting deployed migration history.
Known historical duplicates and invalid grants are normalized explicitly here.
Run against an EMPTY disposable Supabase-compatible database only.
"""
from pathlib import Path
import sys
import re
root = Path(__file__).resolve().parents[1]
for path in sorted((root / 'supabase/migrations').glob('*.sql')):
    sql = path.read_text()
    if path.name == '00000013_unlock_creator_earning_bridge.sql':
        sql = sql.replace('grant execute on function public.unlock_campaign(uuid)', 'grant execute on function public.unlock_campaign(uuid, uuid)')
    if re.search(r'create (?:or replace )?function public\.unlock_campaign\(', sql, re.I):
        sql = re.sub(r'(create (?:or replace )?function public\.unlock_campaign\()', 'drop function if exists public.unlock_campaign(uuid);\ndrop function if exists public.unlock_campaign(uuid,uuid);\n' + r'\1', sql, flags=re.I)
    sql = re.sub(r'drop policy (?!if exists)', 'drop policy if exists ', sql, flags=re.I)
    print('-- SOURCE:', path.name)
    print(sql)
print((root / 'supabase/repairs/audit_commercial_readiness.sql').read_text())
