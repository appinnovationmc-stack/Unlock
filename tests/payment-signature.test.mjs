import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPaystackSignature } from '../lib/payments/signature.ts';
const body = '{"event":"charge.success","data":{"id":1}}';
const secret = 'whsec_test';
const now = 1794614400;
const digest = text => createHmac('sha512', secret).update(text).digest('hex');
test('legacy signature validates exact bytes and rejects altered payloads', () => {
 assert.equal(verifyPaystackSignature(body,digest(body),[secret],now),true);
 assert.equal(verifyPaystackSignature(body+' ',digest(body),[secret],now),false);
 assert.equal(verifyPaystackSignature(body,'xyz',[secret],now),false);
});
test('timestamped signatures enforce freshness and secret rotation', () => {
 const header = `t=${now},v1=whk_old:${'0'.repeat(128)},v1=whk_new:${digest(`${now}.${body}`)}`;
 assert.equal(verifyPaystackSignature(body,header,['old',secret],now),true);
 assert.equal(verifyPaystackSignature(body,header,[secret],now+301),false);
 assert.equal(verifyPaystackSignature(body,header,[secret],now-301),false);
 assert.equal(verifyPaystackSignature(body,header+`,t=${now}`,[secret],now),false);
 assert.equal(verifyPaystackSignature(body,null,[secret],now),false);
});
