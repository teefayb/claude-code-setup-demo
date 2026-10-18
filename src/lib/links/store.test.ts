import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { useTempDataFile } from "@/test/temp-data-file";

import { createLink, dataFilePath, deleteLink, listLinks } from "./store";

describe("links store", () => {
  useTempDataFile();

  it("falls back to the seed data when the data file does not exist", async () => {
    const links = await listLinks();
    expect(links.map((l) => l.id)).toEqual(["seed-adr", "seed-design", "seed-runbook"]);
  });

  it("filters by tag, case-insensitively", async () => {
    const links = await listLinks({ tag: "OPS" });
    expect(links.map((l) => l.id)).toEqual(["seed-runbook"]);
  });

  it("creates a link, normalises tags and persists it", async () => {
    const link = await createLink(
      { title: "  CI dashboard ", url: "https://example.com/ci", tags: ["Ops", "ops", "ci"] },
      new Date("2026-02-01T00:00:00.000Z"),
    );

    expect(link).toMatchObject({
      title: "CI dashboard",
      tags: ["ops", "ci"],
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const onDisk = JSON.parse(await readFile(dataFilePath(), "utf8"));
    expect(onDisk.links).toHaveLength(4);
    expect((await listLinks())[0].id).toBe(link.id);
  });

  it("rejects non-http URLs", async () => {
    await expect(createLink({ title: "x", url: "javascript:alert(1)" })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it("deletes a link and reports missing ids", async () => {
    expect(await deleteLink("seed-design")).toBe(true);
    expect(await deleteLink("seed-design")).toBe(false);
    expect((await listLinks()).map((l) => l.id)).not.toContain("seed-design");
  });
});
