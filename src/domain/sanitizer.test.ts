import test from 'node:test';
import assert from 'node:assert/strict';
import { DataSanitizer } from './sanitizer';

test('DataSanitizer strips raw Bearer tokens and API keys', () => {
  const secretText = 'Sending request with Bearer eyJhbGciOiJIUzI1NiJ9 and apiKey: sk-1234567890abcdef1234567890abcdef';
  const clean = DataSanitizer.sanitizeString(secretText);
  assert.equal(clean.includes('eyJhbGciOiJIUzI1NiJ9'), false);
  assert.equal(clean.includes('sk-1234567890abcdef1234567890abcdef'), false);
  assert.match(clean, /\[REDACTED/);
});

test('DataSanitizer deeply redacts sensitive object keys', () => {
  const payload = {
    user: 'alice',
    password: 'superSecretPassword123!',
    credentials: {
      api_key: 'AIzaSyDemoKey123456789012345678901234',
      token: 'ghp_123456789012345678901234567890123456',
    },
    metadata: {
      environment: 'staging',
    },
  };

  const sanitized = DataSanitizer.sanitizeObject(payload);
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.credentials.api_key, '[REDACTED]');
  assert.equal(sanitized.credentials.token, '[REDACTED]');
  assert.equal(sanitized.user, 'alice');
  assert.equal(sanitized.metadata.environment, 'staging');
});
