import { describe, it, expect } from "vitest";
import { tokenize } from "../tokenizer/index.ts";
import { buildTree } from "../tree/index.ts";
import { extractText } from "./index.ts";

describe("extractText", () => {
  it("ツリーからテキストを抽出する", () => {
    const tree = buildTree(tokenize("<div><p>hello</p><p>world</p></div>"));
    expect(extractText(tree)).toBe("hello world");
  });

  it("scriptタグの中身を無視する", () => {
    const tree = buildTree(tokenize("<div><script>var x = 1;</script><p>hello</p></div>"));
    expect(extractText(tree)).toBe("hello");
  });

  it("styleタグの中身を無視する", () => {
    const tree = buildTree(tokenize("<div><style>body{color:red}</style><p>hello</p></div>"));
    expect(extractText(tree)).toBe("hello");
  });
});
