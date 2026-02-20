import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer.ts";
import { buildTree } from "./tree.ts";

describe("buildTree", () => {
  it("トークンからツリー構造を構築する", () => {
    const tokens = tokenize("<div><p>hello</p></div>");
    const tree = buildTree(tokens);

    expect(tree).toEqual({
      type: "element",
      tagName: "document",
      children: [
        {
          type: "element",
          tagName: "div",
          children: [
            {
              type: "element",
              tagName: "p",
              children: [{ type: "text", content: "hello" }],
            },
          ],
        },
      ],
    });
  });

  it("テキストだけのHTMLを処理できる", () => {
    const tokens = tokenize("hello");
    const tree = buildTree(tokens);

    expect(tree).toEqual({
      type: "element",
      tagName: "document",
      children: [{ type: "text", content: "hello" }],
    });
  });
});
