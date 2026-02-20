import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer.ts";

describe("tokenize", () => {
  it("タグとテキストをトークンに分解する", () => {
    const tokens = tokenize("<p>hello</p>");
    expect(tokens).toEqual([
      { type: "tag", value: "p" },
      { type: "text", value: "hello" },
      { type: "tag", value: "/p" },
    ]);
  });

  it("空白だけのテキストはスキップする", () => {
    const tokens = tokenize("<div>  </div>");
    expect(tokens).toEqual([
      { type: "tag", value: "div" },
      { type: "tag", value: "/div" },
    ]);
  });

  it("ネストしたタグを処理できる", () => {
    const tokens = tokenize("<div><p>text</p></div>");
    expect(tokens).toEqual([
      { type: "tag", value: "div" },
      { type: "tag", value: "p" },
      { type: "text", value: "text" },
      { type: "tag", value: "/p" },
      { type: "tag", value: "/div" },
    ]);
  });
});
