import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

/**
 * Points the store at a fresh temp file for each test.
 * The file starts missing, so the store falls back to data/seed.json.
 */
export function useTempDataFile() {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "teamlinks-"));
    process.env.LINKS_DATA_FILE = path.join(dir, "links.json");
  });
  afterEach(async () => {
    delete process.env.LINKS_DATA_FILE;
    await rm(dir, { recursive: true, force: true });
  });
}
