import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "src");

test("web login exposes Apple OAuth and handles its callback result", () => {
  const modal = readFileSync(join(root, "components", "AuthModal.tsx"), "utf8");
  const state = readFileSync(join(root, "state.tsx"), "utf8");
  expect(modal).toContain("continue-with-apple");
  expect(modal).toContain("/maps/api/auth/apple/start");
  expect(state).toContain("apple_login");
  expect(state).toContain("history.replaceState");
});
