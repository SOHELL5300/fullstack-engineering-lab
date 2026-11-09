# Full-Stack Engineering Lab

A 12-week engineering learning portfolio built through reviewable, tested increments. **Implemented: Week 1 Day 1**, a Node.js 26 ESM JavaScript Task Management REST API. The remaining curriculum is a plan, not a claim of completed work.

## Run locally

Use Node **26.13.0** (see `.nvmrc` and `.node-version`) and its bundled npm.

```sh
nvm install
nvm use
npm ci
npm run check
npm test
npm run test:coverage
npm run dev
```

`npm start` runs without watch mode. Defaults: `HOST=127.0.0.1`, `PORT=3000`. The server reads process environment variables; no dotenv loader or secrets are required. Data disappears when the process restarts. There is no compile/build step: this increment uses native JavaScript ESM rather than TypeScript.

```sh
curl http://127.0.0.1:3000/health
curl -i -X POST http://127.0.0.1:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Complete Week 1 Day 1","priority":"high"}'
curl 'http://127.0.0.1:3000/api/tasks?status=todo&priority=high&q=week'
curl http://127.0.0.1:3000/api/tasks/stats
```

Use the returned task UUID with GET, PATCH, or DELETE `/api/tasks/:id`.

## Portfolio map

- `apps/task-api/`: runnable API, unit and HTTP integration tests.
- `packages/`: reserved location for future shared packages; no speculative framework abstractions.
- `docs/architecture.md`: boundaries, data flow, tradeoffs, limitations.
- `docs/api.md`: endpoint contracts, validation, response examples.
- `docs/roadmap.md`: planned twelve-week progression.
- `docs/learning/week-01/day-01.md`: detailed concepts, exercises, reflection prompts.
- `.github/workflows/ci.yml`: Node 26 install, syntax checks, tests and coverage on pull requests and pushes to main.

## Scope and quality

This is a single-process learning API with an in-memory Map. It implements CRUD, validation, combined filters, aggregate statistics, JSON error responses, bounded request bodies, and shutdown handling. It does **not** implement persistence, authentication, authorization, pagination, rate limiting, distributed consistency, deployment, or production observability. Do not expose it as a public service without addressing those requirements. CI is defined here; a local passing run does not imply GitHub Actions has run.

See [contributing](CONTRIBUTING.md) for the change workflow.
