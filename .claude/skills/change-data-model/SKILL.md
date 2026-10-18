---
name: change-data-model
description: Change the shape of stored data (add, rename or remove a field on Link) safely, including a versioned upgrade of existing data files. Use when a task needs a new or changed stored field.
argument-hint: "[the field change, e.g. add optional 'description' string]"
disable-model-invocation: true
---

Change the data model: $ARGUMENTS

Stored data lives in JSON files that already exist on teammates' machines and on the server,
so every change must read old files without breaking.

## Steps

1. Read `src/lib/links/schema.ts`, `src/lib/links/store.ts` and `data/seed.json`.
2. Decide if the change is **additive** (new optional field with a default) or **breaking**
   (rename, remove, new required field, type change).
   - Additive: add the field with `.optional()` or `.default(...)` to `linkSchema`, and to
     `linkInputSchema` if users can set it. No version bump.
   - Breaking: bump the data file `version` literal (e.g. `1` → `2`). Keep the old schema as
     `dataFileV1Schema`, and add an `upgradeV1toV2(data)` function in `store.ts` that `load()`
     applies when it reads a v1 file. Never rewrite files on read; the next `save()` writes v2.
3. Update `data/seed.json` to the new shape.
4. Update the UI only if the task asks for it.
5. Tests in `src/lib/links/store.test.ts`:
   - The new field round-trips through `createLink` and `listLinks`.
   - For breaking changes: write a v1 file into the temp data path and assert `listLinks()`
     returns upgraded links, and that a following `createLink` saves a v2 file.
6. Run `npm run check` and `npm run build`.
7. In your summary, state whether the change was additive or breaking, and what happens to
   existing data files.
