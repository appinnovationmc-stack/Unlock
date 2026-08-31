# Database reconciliation

## Git migrations (authoritative sequence)

| File | Purpose |
|------|--------|
| 00000000000000_unlock_core_schema.sql | Core multi-tenant schema |
| 00000001–00000004 | Auth provisioning, org policies, brand role, bootstrap |
| 00000005 | Priv-esc / XP forgery closures |
| 00000006 | Production completion fields, claims, participations |
| 00000007 | Redeem + referral unlock |
| 00000008–00000009 | Product hunt claims + storage |
| 00000010 | Commercial money engine |
| 00000011 | Atomic deposit credit |
| 00000012 | Lock down credit_org_deposit grants |
| 00000013 | Unlock → creator earning bridge |
| 20260829124242_* | Prod backfill: org membership escalation |
| 20260829181459_* | Prod backfill: lifecycle/rewards v2 |
| 20260829201411_* | admin_users + create_organization RPC |

## Notes

- Numbered and timestamped migrations may overlap partially (historical parallel work). Prefer applying in chronological order as listed in Supabase migration history.  
- `credit_org_deposit` must remain **not** executable by `anon`/`authenticated`.  
- After deploy, confirm with:  
  `select * from supabase_migrations.schema_migrations order by version;`  
- If production has extra versions not in Git, export and commit them before further schema changes.
