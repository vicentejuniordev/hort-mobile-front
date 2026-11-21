import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateBuildEnvironment } from '../scripts/validate-build.mjs';

test('development permite Metro local sem exigir uma API de homologação', () => {
  assert.doesNotThrow(() => validateBuildEnvironment('development', undefined));
});
test('preview e produção recusam builds sem API HTTPS configurada', () => {
  for (const profile of ['preview', 'production']) {
    for (const value of [
      undefined,
      '',
      'http://192.168.1.2:8000/api/v1/',
      'https://localhost/api/v1/',
      'https://api.example.invalid/api/v1/',
      'https://api.example.test/',
      'https://usuario:senha@api.example.test/api/v1/',
      'https://api.example.test/api/v1/?token=example',
    ]) {
      assert.throws(() => validateBuildEnvironment(profile, value));
    }
    assert.doesNotThrow(() =>
      validateBuildEnvironment(
        profile,
        'https://api.hort.example.test/api/v1/',
      ),
    );
  }
});
