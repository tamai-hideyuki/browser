import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPage } from "./http.ts";

describe("fetchPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("URLを渡すとHTMLテキストが返る", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      text: async () => "<html><body>hello</body></html>",
    }));

    const html = await fetchPage("https://example.com");
    expect(html).toBe("<html><body>hello</body></html>");
  });

  it("HTTPエラーの場合は例外を投げる", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 404,
    }));

    await expect(fetchPage("https://example.com")).rejects.toThrow(
      `HTTP Error: 404`,
    );
  });
});
