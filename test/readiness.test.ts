import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const unavailableDatabase = 'postgres://unused:unused@127.0.0.1:1/unavailable?connect_timeout=1';

for (const [name, script] of [['公開服務', 'src/server.ts'], ['管理服務', 'src/admin-server.ts']]) {
  test(`${name}在資料庫不可連線時不開始監聽`, () => {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', script], {
      cwd: project, env: { ...process.env, DATABASE_URL: unavailableDatabase,
        EVENT_RADAR_ADMIN_PASSWORD: 'local-test-password-only' },
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /無法連接資料庫/);
    assert.doesNotMatch(result.stdout, /listening on/);
  });
}
