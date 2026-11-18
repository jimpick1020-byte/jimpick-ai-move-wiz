import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { appUpdateBlocked, createUpdateRestart, protectAppUpdate } from './update-safety';

test('editing and failed saves block update application until work is safe', () => {
  let dirty = true;
  const cleanup = protectAppUpdate(() => dirty);
  let reloads = 0;
  const apply = createUpdateRestart(appUpdateBlocked, () => reloads++);
  assert.equal(apply(), false);
  assert.equal(reloads, 0);
  // Arbitrarily many attempts do not override protection with a timeout.
  for (let i = 0; i < 121; i++) assert.equal(apply(), false);
  dirty = false;
  assert.equal(apply(), true);
  assert.equal(apply(), false);
  assert.equal(reloads, 1);
  cleanup();
});

test('independent operations retain protection until every blocker is released', () => {
  const doneFirst = protectAppUpdate(() => true);
  const doneSecond = protectAppUpdate(() => true);
  doneFirst();
  assert.equal(appUpdateBlocked(), true);
  doneSecond();
  assert.equal(appUpdateBlocked(), false);
});