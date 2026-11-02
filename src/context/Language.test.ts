import test from 'node:test';
import assert from 'node:assert/strict';
import { translations } from './LanguageContext';

test('i18n translation dictionaries have identical keys for both zh and en', () => {
  const zhKeys = Object.keys(translations.zh).sort();
  const enKeys = Object.keys(translations.en).sort();

  assert.equal(zhKeys.length, enKeys.length);
  assert.deepEqual(zhKeys, enKeys);

  for (const key of zhKeys) {
    const zhVal = (translations.zh as any)[key];
    const enVal = (translations.en as any)[key];
    assert.ok(typeof zhVal === 'string' && zhVal.length > 0, `Key ${key} empty in zh`);
    assert.ok(typeof enVal === 'string' && enVal.length > 0, `Key ${key} empty in en`);
  }
});
