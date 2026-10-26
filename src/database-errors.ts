import type pg from 'pg';

/** pg-pool already removes the broken idle client. Never print its connection details. */
export function handleIdlePoolErrors(pool: pg.Pool,
  log: (message: string) => void = (message) => { process.stderr.write(message); }): void {
  pool.on('error', () => { log('資料庫閒置連線中斷；已移除失效連線，後續請求將重新連線。\n'); });
}
