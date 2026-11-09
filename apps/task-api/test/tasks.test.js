import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTaskStore, validateTask, validateFilters } from '../src/tasks.js';

test('creation normalizes title, supplies defaults, and prevents mutation of stored data', () => {
  const store = createTaskStore({ id: () => 'fixed', now: () => '2026-01-01T00:00:00.000Z' });
  const task = store.create({ title: '  Learn Node  ' });
  assert.deepEqual(task, { id: 'fixed', title: 'Learn Node', description: '', status: 'todo', priority: 'medium', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  task.title = 'changed';
  store.list()[0].title = 'changed';
  assert.equal(store.get('fixed').title, 'Learn Node');
});
test('validation rejects bad shapes, fields, lengths, and enums', () => {
  for (const input of [null, [], 'title', {}, { title: '' }, { title: '   ' }, { title: 3 }, { title: 'x'.repeat(201) }, { title: 'ok', description: null }, { title: 'ok', description: 'x'.repeat(2001) }, { title: 'ok', status: 'closed' }, { title: 'ok', priority: 'urgent' }, { title: 'ok', id: 'injected' }]) {
    assert.throws(() => validateTask(input), { status: 400 });
  }
  assert.throws(() => validateTask({}, true), { status: 400 });
  assert.deepEqual(validateTask({ title: 'x'.repeat(200), description: 'x'.repeat(2000) }).title.length, 200);
});
test('patch preserves identity and creation time, updates timestamp, and delete reports missing tasks', () => {
  let tick = 0;
  const store = createTaskStore({ id: () => 'fixed', now: () => String(++tick) });
  store.create({ title: 'Task' });
  const updated = store.update('fixed', { status: 'done' });
  assert.equal(updated.createdAt, '1');
  assert.equal(updated.updatedAt, '2');
  assert.equal(updated.id, 'fixed');
  assert.equal(updated.title, 'Task');
  assert.equal(updated.status, 'done');
  store.delete('fixed');
  for (const operation of [() => store.get('fixed'), () => store.update('fixed', { title: 'x' }), () => store.delete('fixed')]) assert.throws(operation, { status: 404 });
});
test('combined filtering, case-insensitive search, and statistics match the selected population', () => {
  const store = createTaskStore();
  store.create({ title: 'Learn Node', priority: 'high' });
  store.create({ title: 'Write tests', description: 'NODE coverage', status: 'done', priority: 'high' });
  store.create({ title: 'Read', priority: 'low' });
  assert.equal(store.list({ q: 'node', priority: 'high', status: 'done' }).length, 1);
  assert.deepEqual(store.statistics({ q: 'node' }), { total: 2, byStatus: { todo: 1, in_progress: 0, done: 1 }, byPriority: { low: 0, medium: 0, high: 2 } });
  assert.equal(createTaskStore().statistics().total, 0);
});
test('query validation rejects unsupported, duplicate, empty and invalid filters', () => {
  for (const query of ['sort=title', 'status=done&status=todo', 'status=bad', 'priority=urgent', 'q=', 'q='+ 'x'.repeat(201)]) assert.throws(() => validateFilters(new URLSearchParams(query)), { status: 400 });
  assert.deepEqual(validateFilters(new URLSearchParams('q=NODE&status=todo')), { q: 'node', status: 'todo' });
});
