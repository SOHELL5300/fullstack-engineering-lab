# Week 1 Day 1 — Build a task API from HTTP primitives

## Learning goals and implemented evidence

Understand Node's request/response lifecycle, ESM module boundaries, JSON parsing, resource-oriented routes, validation, state ownership and test isolation. The evidence is the runnable task API, its unit/HTTP tests and documented contract. JavaScript is implemented; a TypeScript migration is a later milestone.

## 1. ESM and the runtime

The nearest package.json declares `"type":"module"`, so `.js` files use import/export. Relative imports include `.js` extensions. Node executes these modules directly; there is no transpilation or build artifact. Pinning Node 26.13.0 makes local and CI behavior easier to compare. `engines` describes compatibility, while `.nvmrc` selects the intended version for nvm; neither silently changes your active shell runtime.

## 2. From bytes to domain data

`createServer` receives an IncomingMessage and ServerResponse. The URL selects a route and the method selects an action. A POST body arrives as stream chunks, not an already-parsed object. `readJson` checks the media type, counts raw bytes, collects chunks and then parses JSON. A syntactically valid value such as `[]` is still invalid task data, so field validation is a separate step. Keeping these boundaries distinct makes failures explainable: 415 for media type, 413 for size, 400 for syntax or field rules.

`await` suspends a request handler while I/O is pending; it does not create a thread or make CPU-heavy computation cheap. The Map operations are synchronous and short. A later database layer will require async calls and a fresh look at races and transactions.

## 3. Model resources and responses

A task is a resource identified by a server-generated UUID. POST to the collection creates one and returns 201 plus a Location header. GET reads without changing it. PATCH changes only supplied fields. DELETE removes it and returns 204 with no JSON body. Repeating DELETE returns 404 here: idempotency concerns the resulting server state, not identical response codes.

The collection response includes `data` and `meta.total`; a single task uses `data`. Stable error codes let clients react without parsing English text. An invalid UUID is 400, while a well-shaped UUID absent from storage is 404. 405 means the route exists but the method is unsupported.

## 4. Protect invariants

Validation rejects unknown fields so clients cannot overwrite IDs or timestamps. Creation supplies explicit defaults. A patch cannot be empty, and it cannot set a required title to whitespace. Trimming the title once at the boundary gives storage a clear invariant. The store returns copies because returning the same object held by a Map would allow callers to bypass validation through direct mutation.

A store closure hides state and a factory gives each app an independent instance. Tests can supply a deterministic ID and clock to assert exact results without brittle timing checks. These are small dependency-injection seams, not a general dependency container.

## 5. Query and aggregate

Filters combine with AND. Search lowercases both input and searchable text. Statistics use the same selected population as list queries and include zero-valued buckets, making chart clients simpler. Try predicting counts before calling `/api/tasks/stats?status=done`. Scanning memory is O(n); learn to measure before adding indexing, caching or SQL.

## 6. Test behavior at two levels

Unit tests call validation/store functions directly for fast, focused failures. Integration tests listen on port 0, letting the operating system choose a free port, then use real fetch requests. Cleanup hooks close servers even when assertions fail. A passing unit test cannot establish correct HTTP status codes, and a listening port alone cannot establish working CRUD. The suite therefore checks both.

Run `npm run test:coverage` to see executed lines and branches. Coverage indicates which code ran, not whether every assertion is useful. Read a test, deliberately imagine an incorrect implementation and ask whether it would fail. Unexpected failures are tested with an injected throwing store so the public 500 response can be checked independently of internal error details.

## Practice and reflection

1. Create two tasks with different priorities, patch one to done, then predict filtered statistics.
2. Compare malformed JSON, an empty title, an unknown field and an unknown UUID; explain each status.
3. Restart the server and observe lost data. Explain why a database is required before durable use.
4. Read the copy-isolation test and describe the bug it prevents.
5. Sketch how a database repository would change async call sites without implementing it yet.
6. Record what you can now explain, where you needed documentation, and one justified next improvement.

## Definition of done for this increment

CRUD and health work through real HTTP; invalid input has documented failures; filtered counts are reproducible; node:test unit and integration tests pass; syntax checks pass; architecture and limitations are explicit; CI is configured. GitHub Actions execution and publication are separate evidence and must be reported only after observed.
