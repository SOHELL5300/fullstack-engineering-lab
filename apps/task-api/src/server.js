import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const server = createApp();
server.on('error', (error) => { console.error(error); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Task API listening on ${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close((error) => { if (error) process.exitCode = 1; });
    setTimeout(() => { server.closeAllConnections(); }, 5000).unref();
  });
}
