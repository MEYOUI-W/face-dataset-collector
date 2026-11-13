import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

describe('environment smoke check', () => {
  it('supports in-memory node:sqlite DatabaseSync', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE ping (id INTEGER PRIMARY KEY)');
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
    expect(row.ok).toBe(1);
    db.close();
  });
});
