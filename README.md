# Teamlinks

Shared bookmarks for the team: add a link with tags, filter by tag, delete.

## Develop

```bash
npm ci
npm run dev      # http://localhost:3000
npm run check    # typecheck + lint + format check + tests
npm run build
```

Data is stored in `data/links.local.json` (gitignored). Set `LINKS_DATA_FILE` to use
another path. When the file doesn't exist, the app starts from `data/seed.json`.

## API

- `GET /api/links?tag=ops` → `{ links: Link[] }`
- `POST /api/links` `{ title, url, tags? }` → `201 { link }` · `400 { error, details? }`
- `DELETE /api/links/:id` → `204` · `404 { error: "not_found" }`
