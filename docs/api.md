# Task API contract — Week 1 Day 1

Base path: `/api`. JSON requests use `Content-Type: application/json` (an optional charset is accepted). A task contains `id` (UUID), `title`, `description`, `status`, `priority`, `createdAt`, and `updatedAt` (ISO 8601 timestamps).

| Method | Path | Success | Behavior |
| --- | --- | --- | --- |
| GET | `/health` | 200 | `{"status":"ok"}`; process liveness only |
| GET | `/api/tasks` | 200 | `{"data":[],"meta":{"total":0}}` |
| POST | `/api/tasks` | 201 | `{"data":task}` and `Location` header |
| GET | `/api/tasks/stats` | 200 | `{"data":{"total":0,"byStatus":{"todo":0,"in_progress":0,"done":0},"byPriority":{"low":0,"medium":0,"high":0}}}` |
| GET | `/api/tasks/:id` | 200 | `{"data":task}` |
| PATCH | `/api/tasks/:id` | 200 | `{"data":updatedTask}` |
| DELETE | `/api/tasks/:id` | 204 | Empty response body |

## Write rules

POST requires a trimmed, nonempty title of at most 200 JavaScript string code units. Description is a string of at most 2000 code units and defaults to empty. Status is `todo` (default), `in_progress`, or `done`; priority is `low`, `medium` (default), or `high`. PATCH accepts a nonempty subset of these four fields and preserves unspecified fields. Unknown fields (including caller-supplied IDs/timestamps), nulls, arrays, invalid enum values, and wrong types are rejected. Description whitespace is preserved. Any allowed status transition is accepted; there is no workflow state machine.

Example patch: `{"status":"done","description":"Reviewed tests"}`. IDs and creation timestamps are immutable; every accepted patch refreshes updatedAt, even if values are unchanged.

## Filters and statistics

GET list and stats accept single `status`, `priority`, and `q` query parameters, combined with AND. `q` searches title and description case-insensitively; it must be nonblank and at most 200 code units before trimming. Repeated or unknown query keys and invalid values return 400. Statistics describe the filtered set and always include every status/priority bucket. List order is insertion order; there is no pagination. Other endpoints ignore query parameters. Paths are exact; trailing slashes are not aliases. The reserved `/stats` route takes precedence over `/:id`.

## Errors

All handled errors use `{"error":{"code":"VALIDATION_ERROR","message":"..."}}`. Messages are human-readable; clients should branch on status/code.

| Status | Codes | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_ID` | Invalid fields, malformed/empty JSON, or malformed UUID |
| 404 | `NOT_FOUND`, `TASK_NOT_FOUND` | Unknown route or absent task |
| 405 | `METHOD_NOT_ALLOWED` | Known route, unsupported method; includes `Allow` |
| 413 | `PAYLOAD_TOO_LARGE` | Streamed request body exceeds 16 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Write request is not application/json |
| 500 | `INTERNAL_ERROR` | Unexpected failure; details go to server error callback |

Validation order matters: routes and methods are checked first, then IDs, then JSON parsing and store operations. For PATCH, once JSON is parsed, a missing task is reported before task-field validation. Node's HTTP parser may reject malformed protocol traffic before the application, outside this JSON contract. Responses use `Cache-Control: no-store`. HEAD, CORS preflight and browser cross-origin support are not implemented.
