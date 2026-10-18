---
name: add-api-route
description: Add a new Next.js route handler under src/app/api with Zod validation, consistent errors and Vitest tests. Use when asked to add or extend an API endpoint.
argument-hint: "[METHOD /api/path] [what it does]"
---

Add the API route described here: $ARGUMENTS

If the method, path or behaviour is unclear, ask one short question before writing code.

## Steps

1. Read `src/app/api/links/route.ts`, `src/lib/http.ts` and `src/lib/links/schema.ts` to match
   the existing patterns. Do not invent a new error format.
2. Put input validation in a Zod schema in the relevant `src/lib/<domain>/schema.ts`, not inline
   in the route.
3. Put data access in `src/lib/<domain>/store.ts`. The route handler only parses, calls the store,
   and maps results to responses.
4. Create `src/app/api/<path>/route.ts`:
   - `export const dynamic = "force-dynamic";`
   - Malformed JSON → `errorResponse(400, "invalid_json")`
   - `ZodError` → `validationError(err)`
   - Not found → `errorResponse(404, "not_found")`
   - Dynamic segments: `{ params }: { params: Promise<{ id: string }> }` and `await params`.
5. Write `route.test.ts` next to the route. Use `useTempDataFile()` from `@/test/temp-data-file`
   and call the exported handlers with `new Request(...)`. Cover: success, each validation
   failure class, not found, and malformed JSON where a body is accepted.
6. Run `npx vitest run <the new test file>`, then `npm run check`, then `npm run build`.
7. Report: the endpoint contract (method, path, request body, responses with status codes) and
   the commands you ran with their result.
