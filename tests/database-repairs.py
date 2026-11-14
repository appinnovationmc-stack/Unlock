"""Integration tests against the disposable local database; never targets production."""
import subprocess, concurrent.futures, uuid, os
PSQL=os.environ.get('PSQL_BIN','psql')
def sql(query, fail=False):
 p=subprocess.run([PSQL,'-X','-h','127.0.0.1','-p','55432','-d','unlock_repair_test','-At','-v','ON_ERROR_STOP=1','-c',query],capture_output=True,text=True)
 if fail:
  assert p.returncode, 'Expected operation to be rejected'
  return p.stderr
 assert p.returncode==0,p.stderr
 return p.stdout.strip()
def uid(): return str(uuid.uuid4())
brand,other,*consumers=[uid() for _ in range(10)]
org,org2,campaign,reward,intent=[uid() for _ in range(5)]
for user in [brand,other,*consumers]:sql(f"insert into auth.users(id) values('{user}')")
sql(f"insert into organizations(id,name) values('{org}','Test A'),('{org2}','Test B'); insert into org_members values('{org}','{brand}','owner'),('{org2}','{other}','owner'); insert into campaigns(id,org_id,title,status) values('{campaign}','{org}','Test','live'); insert into rewards(id,org_id,campaign_id,type,label,value,stock) values('{reward}','{org}','{campaign}','discount','Last unit','Test',1); update private.payment_controls set live_enabled=true;")
def as_user(user,query):return f"set role authenticated; set request.jwt.claim.sub='{user}'; {query}"
sql(as_user(other,f"insert into rewards(org_id,campaign_id,type,label,value) values('{org2}','{campaign}','discount','Attack','X')"),fail=True)
print('PASS cross-tenant reward insert rejected under authenticated role')
sql(as_user(brand,f"insert into payment_intents(org_id,amount_cents,purpose,provider,idempotency_key) values('{org}',100,'top_up','paystack','forged')"),fail=True)
print('PASS direct payment intent insert rejected')
ref='dep_'+uid()
sql(f"insert into payment_intents(id,org_id,amount_cents,currency,purpose,status,provider,provider_reference,idempotency_key,metadata) values('{intent}','{org}',100000,'ZAR','top_up','pending','paystack','{ref}','{ref}','{{\"is_sandbox\":false}}')")
def event(event_id,amount=100000):
 return f"set role service_role; select process_payment_event('{event_id}','charge.success','{{\"event\":\"charge.success\",\"data\":{{\"reference\":\"{ref}\",\"amount\":{amount},\"currency\":\"ZAR\",\"status\":\"success\",\"domain\":\"live\"}}}}',false)"
sql(event('wrong-amount',999),fail=True)
assert sql(f"select status from payment_intents where id='{intent}'")=='pending'
print('PASS wrong amount rolls back settlement')
sql("create function private.test_credit_failure() returns trigger language plpgsql as $$begin raise exception 'injected credit failure'; end;$$; create trigger test_credit_failure before insert on financial_ledger for each row execute function private.test_credit_failure();")
sql(event('recoverable'),fail=True)
assert sql(f"select status from payment_intents where id='{intent}'")=='pending'
sql('drop trigger test_credit_failure on financial_ledger; drop function private.test_credit_failure()')
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(lambda _:sql(event('recoverable')),range(8)))
assert sql(f"select available_balance_cents from org_financial_accounts where org_id='{org}'")=='100000'
assert sql(f"select count(*) from financial_ledger where reference_id='{intent}' and entry_type='brand_deposit'")=='1'
assert sql(f"select status from payment_intents where id='{intent}'")=='succeeded'
print('PASS injected credit failure recovers and eight concurrent retries credit exactly once')
def claim(user):
 try:
  sql(f"set request.jwt.claim.sub='{user}'; insert into reward_claims(reward_id,campaign_id,consumer_id) values('{reward}','{campaign}','{user}')")
  return True
 except AssertionError as e:
  assert 'out of stock' in str(e),str(e)
  return False
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(claim,consumers))
assert sum(results)==1,results
assert sql(f"select count(*) from reward_claims where reward_id='{reward}'")=='1'
print('PASS eight consumers competing for last unit produce one claim')
# Gross 100000, fee 15000, net 85000; fee cannot be spent by the campaign.
sql(as_user(brand,f"select fund_campaign_budget('{campaign}',100000,0,0,85000,'ZAR')"))
assert sql(f"select reserved_balance_cents from org_financial_accounts where org_id='{org}'")=='85000'
assert sql(f"select lifetime_fees_cents from org_financial_accounts where org_id='{org}'")=='15000'
sql(f"update campaign_budgets set spent_cents=85001 where campaign_id='{campaign}'",fail=True)
print('PASS funding separates fees and prevents spending beyond net budget')
sql(as_user(brand,f"update campaigns set status='ended' where id='{campaign}'"))
assert sql(f"select available_balance_cents||':'||reserved_balance_cents from org_financial_accounts where org_id='{org}'")=='85000:0'
print('PASS closing campaign releases unused net funds once')
sql(as_user(brand,f"update campaigns set status='live' where id='{campaign}'"),fail=True)
print('PASS closed funded campaign cannot reopen against released reserves')
# Token-based merchant fulfilment cannot be triggered by the consumer.
c2,r2,claim_id=[uid() for _ in range(3)]
sql(f"insert into campaigns(id,org_id,title,status) values('{c2}','{org2}','Merchant test','live'); insert into rewards(id,org_id,campaign_id,type,label,value) values('{r2}','{org2}','{c2}','discount','Voucher','Test'); set request.jwt.claim.sub='{consumers[0]}'; insert into reward_claims(id,reward_id,campaign_id,consumer_id) values('{claim_id}','{r2}','{c2}','{consumers[0]}')")
token=sql(as_user(consumers[0],f"select prepare_reward_redemption('{claim_id}')")).splitlines()[-1]
sql(as_user(consumers[0],f"select merchant_redeem_reward('{token}')"),fail=True)
sql(as_user(brand,f"select merchant_redeem_reward('{token}')"),fail=True)
sql(as_user(other,f"select merchant_redeem_reward('{token}')"))
assert sql(f"select status from reward_claims where id='{claim_id}'")=='redeemed'
assert sql(f"select count(*) from interaction_events where idempotency_key='redeem:{claim_id}'")=='1'
print('PASS only owning merchant fulfils claim and redemption analytics are atomic')
# Prevent the owner from un-hiding moderated content through the Data API.
post=uid()
sql(as_user(consumers[0],f"insert into experience_posts(id,campaign_id,user_id,caption) values('{post}','{c2}','{consumers[0]}','Test')"))
sql(f"update experience_posts set hidden_at=now() where id='{post}'")
sql(as_user(consumers[0],f"update experience_posts set hidden_at=null where id='{post}'"),fail=True)
print('PASS content owners cannot reverse moderation hides')
# Retried budget top-ups must not debit funds twice.
c3=uid();topup_key=uid()
sql(f"insert into campaigns(id,org_id,title,status) values('{c3}','{org}','Top-up','live')")
sql(as_user(brand,f"select fund_campaign_budget('{c3}',20000,0,0,17000,'ZAR')"))
for _ in range(2): sql(as_user(brand,f"select top_up_campaign_budget('{c3}',10000,'{topup_key}')"))
assert sql(f"select total_budget_cents from campaign_budgets where campaign_id='{c3}'")=='30000'
print('PASS repeated top-up request debits funds once')
# Concurrent GPS requests serialize the billable visit entitlement.
location=uid(); visitor=consumers[1]
sql(f"insert into campaign_locations(id,org_id,campaign_id,label,geog,radius_m) values('{location}','{org}','{c3}','Test pin',ST_SetSRID(ST_MakePoint(28,-26),4326)::geography,100)")
events=[uid() for _ in range(8)]
for event_id in events:
 sql(f"insert into interaction_events(id,user_id,campaign_id,event_type,verification_method,metadata) values('{event_id}','{visitor}','{c3}','LOCATION_CHECKIN','location','{{\"accuracy\":10}}')")
def checkin(event_id):return sql(as_user(visitor,f"select verified from verify_location_checkin('{event_id}',-26,28)"))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(checkin,events))
assert sql(f"select count(*) from interaction_events where user_id='{visitor}' and campaign_id='{c3}' and verification_status='verified'")=='1'
assert sql(f"select count(*) from financial_ledger where campaign_id='{c3}' and reference_type='visit_spend'")=='1'
print('PASS eight concurrent GPS requests produce one verified and billed visit')

print('All database integration checks passed.')
