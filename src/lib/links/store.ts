import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { dataFileSchema, linkInputSchema, type DataFile, type Link } from "./schema";

const SEED_FILE = path.join(process.cwd(), "data", "seed.json");
const DEFAULT_FILE = path.join(process.cwd(), "data", "links.local.json");

/** Resolved on every call so tests can point LINKS_DATA_FILE at a temp file. */
export function dataFilePath(): string {
  return process.env.LINKS_DATA_FILE || DEFAULT_FILE;
}

async function load(): Promise<DataFile> {
  const file = dataFilePath();
  let raw: string;
  try {
    raw = await readFile(/*turbopackIgnore: true*/ file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    raw = await readFile(SEED_FILE, "utf8");
  }
  return dataFileSchema.parse(JSON.parse(raw));
}

/** Write to a temp file then rename, so a crash never leaves half a JSON file. */
async function save(data: DataFile): Promise<void> {
  const file = dataFilePath();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await rename(tmp, file);
}

export async function listLinks(filter: { tag?: string } = {}): Promise<Link[]> {
  const { links } = await load();
  const tag = filter.tag?.trim().toLowerCase();
  const matching = tag ? links.filter((l) => l.tags.includes(tag)) : links;
  return [...matching].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createLink(input: unknown, now: Date = new Date()): Promise<Link> {
  const parsed = linkInputSchema.parse(input);
  const data = await load();
  const link: Link = { id: randomUUID(), ...parsed, createdAt: now.toISOString() };
  data.links.push(link);
  await save(data);
  return link;
}

/** Returns false when no link has that id. */
export async function deleteLink(id: string): Promise<boolean> {
  const data = await load();
  const remaining = data.links.filter((l) => l.id !== id);
  if (remaining.length === data.links.length) return false;
  await save({ ...data, links: remaining });
  return true;
}
