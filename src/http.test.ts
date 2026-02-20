import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPage } from "./http.ts";

describe("fetchPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("URLを渡すとHTMLテキストが返る", async () => {
    vi.stubGlobal("fetch", async () => ({
      text: async () => "<html><body>hello</body></html>",
    }));

    const html = await fetchPage("https://example.com");
    expect(html).toBe("<html><body>hello</body></html>");
  });
});
