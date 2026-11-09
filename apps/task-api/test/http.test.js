import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

async function fixture(t, options) {
  const server = createApp(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(base + path, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined };
  };
}
test('HTTP lifecycle: health, create, list, read, patch, filter, statistics, delete', async (t) => {
  const request = await fixture(t);
  assert.deepEqual((await request('/health')).body, { status: 'ok' });
  assert.deepEqual((await request('/api/tasks')).body, { data: [], meta: { total: 0 } });
  const created = await request('/api/tasks', 'POST', { title: ' Learn HTTP ', priority: 'high' });
  assert.equal(created.status, 201);
  const task = created.body.data;
  assert.equal(task.title, 'Learn HTTP');
  assert.ok(!Number.isNaN(Date.parse(task.createdAt)));
  const path = `/api/tasks/${task.id}`;
  assert.equal(created.headers.get('location'), path);
  assert.deepEqual((await request(path)).body.data, task);
  const patched = await request(path, 'PATCH', { status: 'done' });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.status, 'done');
  assert.equal((await request('/api/tasks?status=todo')).body.meta.total, 0);
  assert.equal((await request('/api/tasks?status=done&priority=high&q=HTTP')).body.meta.total, 1);
  assert.deepEqual((await request('/api/tasks/stats?status=done')).body.data, { total: 1, byStatus: { todo: 0, in_progress: 0, done: 1 }, byPriority: { low: 0, medium: 0, high: 1 } });
  const deleted = await request(path, 'DELETE');
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, undefined);
  assert.equal((await request(path)).status, 404);
  assert.equal((await request(path, 'PATCH', { title: 'missing' })).status, 404);
  assert.equal((await request(path, 'DELETE')).status, 404);
});
test('HTTP validation and routing errors have stable JSON contracts', async (t) => {
  const request = await fixture(t);
  for (const [path, method, body, status, code] of [
    ['/missing', 'GET', undefined, 404, 'NOT_FOUND'],
    ['/api/tasks/bad', 'GET', undefined, 400, 'INVALID_ID'],
    ['/api/tasks/00000000-0000-4000-8000-000000000000', 'GET', undefined, 404, 'TASK_NOT_FOUND'],
    ['/api/tasks', 'POST', { title: ' ' }, 400, 'VALIDATION_ERROR'],
    ['/api/tasks', 'POST', [], 400, 'VALIDATION_ERROR'],
    ['/api/tasks', 'POST', { title: 'x', surprise: true }, 400, 'VALIDATION_ERROR'],
    ['/api/tasks?status=bad', 'GET', undefined, 400, 'VALIDATION_ERROR'],
    ['/api/tasks/stats?priority=urgent', 'GET', undefined, 400, 'VALIDATION_ERROR'],
  ]) {
    const response = await request(path, method, body);
    assert.equal(response.status, status);
    assert.equal(response.body.error.code, code);
    assert.match(response.headers.get('content-type'), /application\/json/);
  }
  const method = await request('/api/tasks', 'PUT');
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'GET, POST');
  assert.equal((await request('/api/tasks', 'POST', { title: 'ok' }, { 'Content-Type': 'text/plain' })).status, 415);
  const task = (await request('/api/tasks', 'POST', { title: 'ok' })).body.data;
  assert.equal((await request(`/api/tasks/${task.id}`, 'PATCH', {})).status, 400);
  assert.equal((await request('/api/tasks', 'POST', { title: 'ok', description: 'x'.repeat(17000) })).status, 413);
});
test('malformed and empty JSON return 400', async (t) => {
  const server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  for (const body of ['{', '']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_JSON');
  }
});
test('unexpected errors are reported privately and sanitized for clients', async (t) => {
  const errors = [];
  const request = await fixture(t, { store: { list() { throw new Error('private implementation detail'); } }, onError: (error) => errors.push(error) });
  const response = await request('/api/tasks');
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  assert.equal(errors.length, 1);
});
test('app instances isolate task state', async (t) => {
  const first = await fixture(t);
  const second = await fixture(t);
  await first('/api/tasks', 'POST', { title: 'Private to first instance' });
  assert.equal((await second('/api/tasks')).body.meta.total, 0);
});
