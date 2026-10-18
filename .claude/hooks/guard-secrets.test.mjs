import { describe, expect, it } from "vitest";

import { checkWrite } from "./guard-secrets.mjs";

// Fake credentials are assembled at runtime so this file never contains one literally
// (otherwise the hook would, correctly, refuse to let Claude edit it).
const fake = {
  aws: "AKIA" + "ABCDEFGHIJKLMNOP",
  github: "ghp" + "_" + "a".repeat(36),
  stripe: "sk" + "_live_" + "b".repeat(24),
  pem: "-----BEGIN " + "RSA PRIVATE KEY-----",
};

describe("guard-secrets hook", () => {
  it.each([
    ".env",
    ".env.local",
    "config/.env.production",
    "certs/server.pem",
    "deploy.key",
    "id_rsa",
  ])("blocks writing %s", (file) => {
    expect(checkWrite(file, "")).toMatch(/blocked/);
  });

  it("allows .env.example and normal source files", () => {
    expect(checkWrite(".env.example", "LINKS_DATA_FILE=\n")).toBeNull();
    expect(checkWrite("src/lib/links/store.ts", "export const x = 1;")).toBeNull();
  });

  it.each(Object.entries(fake))("blocks content containing a %s credential", (_kind, value) => {
    expect(checkWrite("src/config.ts", `const value = "${value}";`)).not.toBeNull();
  });

  it("blocks hard-coded secret assignments but not placeholders, env reads or URLs", () => {
    const hardcoded = "const apiKey = '" + "q8Zr2LmN4vT7wX1yB5cD" + "';";
    expect(checkWrite("src/a.ts", hardcoded)).toMatch(/hard-coded/);
    expect(checkWrite("src/a.ts", 'const apiKey = "your-api-key-placeholder";')).toBeNull();
    expect(checkWrite("src/a.ts", "const apiKey = process.env.API_KEY;")).toBeNull();
    expect(
      checkWrite("src/a.ts", 'const tokenUrl = "https://auth.example.com/oauth/token";'),
    ).toBeNull();
    expect(checkWrite("src/a.ts", 'const author = "Grace Hopper and team";')).toBeNull();
  });
});
