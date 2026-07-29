import { describe, expect, test } from "bun:test";
import { readSidebarCollapsed, writeSidebarCollapsed } from "./sidebarState";

describe("sidebar persistence", () => {
  test("defaults expanded and persists a valid collapsed state", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(readSidebarCollapsed(storage)).toBe(false);
    writeSidebarCollapsed(true, storage);
    expect(readSidebarCollapsed(storage)).toBe(true);
  });
});
