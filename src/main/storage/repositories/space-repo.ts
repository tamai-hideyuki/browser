import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { rowToSpace } from './_helpers';
import type { Space } from '@shared/types/space';
import type { SpaceId } from '@shared/types/tab';

export const SpaceRepository = {
  list(): Space[] {
    const rows = getDb().prepare('SELECT * FROM spaces ORDER BY position ASC').all() as any[];
    return rows.map(rowToSpace);
  },

  ensureDefault(): Space {
    const existing = this.list();
    if (existing.length > 0) return existing[0]!;
    const now = Date.now();
    const id = randomUUID() as SpaceId;
    getDb().prepare(`
      INSERT INTO spaces (id, name, icon, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'Default', null, 0, now, now);
    return {
      id,
      name: 'Default',
      icon: null,
      position: 0,
      createdAt: now,
      updatedAt: now,
    };
  },
};
