import { describe, expect, it } from "vitest";

import { useTempDataFile } from "@/test/temp-data-file";

import { DELETE } from "./[id]/route";
import { GET, POST } from "./route";

const base = "http://localhost/api/links";

function post(body: string) {
  return POST(
    new Request(base, { method: "POST", headers: { "content-type": "application/json" }, body }),
  );
}

describe("/api/links", () => {
  useTempDataFile();

  it("GET returns links, optionally filtered by tag", async () => {
    const all = await (await GET(new Request(base))).json();
    expect(all.links).toHaveLength(3);

    const docs = await (await GET(new Request(`${base}?tag=docs`))).json();
    expect(docs.links.map((l: { id: string }) => l.id)).toEqual(["seed-adr"]);
  });

  it("POST creates a link and returns 201", async () => {
    const res = await post(JSON.stringify({ title: "Status page", url: "https://example.com/s" }));
    expect(res.status).toBe(201);
    const { link } = await res.json();
    expect(link).toMatchObject({ title: "Status page", tags: [] });
  });

  it("POST returns 400 with details for invalid input", async () => {
    const res = await post(JSON.stringify({ title: "", url: "nope" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.details.length).toBeGreaterThan(0);
  });

  it("POST returns 400 for malformed JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_json");
  });

  it("DELETE returns 204, then 404 for the same id", async () => {
    const params = Promise.resolve({ id: "seed-runbook" });
    expect((await DELETE(new Request(`${base}/seed-runbook`), { params })).status).toBe(204);
    const again = await DELETE(new Request(`${base}/seed-runbook`), {
      params: Promise.resolve({ id: "seed-runbook" }),
    });
    expect(again.status).toBe(404);
  });
});
