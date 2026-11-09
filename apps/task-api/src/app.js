import { createServer } from 'node:http';
import { HttpError } from './errors.js';
import { createTaskStore, validateFilters } from './tasks.js';

const MAX_BODY_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use Content-Type: application/json.');
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Body exceeds 16 KiB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'INVALID_JSON', 'Body must contain valid JSON.'); }
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data === undefined ? undefined : JSON.stringify(data));
}

export function createApp({ store = createTaskStore(), onError = console.error } = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      let allowed;
      let taskId;
      if (path === '/health') allowed = ['GET'];
      else if (path === '/api/tasks') allowed = ['GET', 'POST'];
      else if (path === '/api/tasks/stats') allowed = ['GET'];
      else {
        const match = path.match(/^\/api\/tasks\/([^/]+)$/);
        if (match) { taskId = match[1]; allowed = ['GET', 'PATCH', 'DELETE']; }
      }
      if (!allowed) throw new HttpError(404, 'NOT_FOUND', 'Route not found.');
      if (!allowed.includes(req.method)) {
        res.setHeader('Allow', allowed.join(', '));
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      }
      if (path === '/health') return send(res, 200, { status: 'ok' });
      if (path === '/api/tasks/stats') return send(res, 200, { data: store.statistics(validateFilters(url.searchParams)) });
      if (path === '/api/tasks') {
        if (req.method === 'GET') {
          const data = store.list(validateFilters(url.searchParams));
          return send(res, 200, { data, meta: { total: data.length } });
        }
        const task = store.create(await readJson(req));
        res.setHeader('Location', `/api/tasks/${task.id}`);
        return send(res, 201, { data: task });
      }
      if (!UUID.test(taskId)) throw new HttpError(400, 'INVALID_ID', 'Task id must be a UUID.');
      if (req.method === 'GET') return send(res, 200, { data: store.get(taskId) });
      if (req.method === 'PATCH') return send(res, 200, { data: store.update(taskId, await readJson(req)) });
      store.delete(taskId);
      return send(res, 204);
    } catch (error) {
      const expected = error instanceof HttpError;
      if (!expected) onError(error);
      if (!res.destroyed) send(res, expected ? error.status : 500, {
        error: { code: expected ? error.code : 'INTERNAL_ERROR', message: expected ? error.message : 'An unexpected error occurred.' },
      });
    }
  });
}
