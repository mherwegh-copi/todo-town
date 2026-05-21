import { describe, it, expect } from 'vitest';
import { mergeTodos, type CloudTodo } from '../../../../src/systems/cloud/merge';

function todo(id: string, updatedAt: number, over: Partial<CloudTodo> = {}): CloudTodo {
  return { id, text: id, done: false, createdAt: 1, updatedAt, deleted: false, ...over };
}

describe('mergeTodos', () => {
  it('garde un id présent d\'un seul côté', () => {
    const out = mergeTodos([todo('a', 10)], [todo('b', 20)]);
    expect(out.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('garde la version au updatedAt le plus grand pour un id partagé', () => {
    const out = mergeTodos([todo('a', 10, { text: 'vieux' })], [todo('a', 20, { text: 'neuf' })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe('neuf');
  });

  it('un tombstone plus récent gagne sur une version active', () => {
    const out = mergeTodos([todo('a', 10)], [todo('a', 20, { deleted: true })]);
    expect(out[0]!.deleted).toBe(true);
  });

  it('une version active plus récente gagne sur un tombstone', () => {
    const out = mergeTodos([todo('a', 30)], [todo('a', 20, { deleted: true })]);
    expect(out[0]!.deleted).toBe(false);
  });

  it('en cas d\'égalité de updatedAt, le remote gagne', () => {
    const out = mergeTodos([todo('a', 10, { text: 'local' })], [todo('a', 10, { text: 'remote' })]);
    expect(out[0]!.text).toBe('remote');
  });
});
