import type { Token, Node, ElementNode } from "./types.ts";

/**
 * 閉じタグかどうかを判定する（
 */
const isClosingTag = (tagValue: string): boolean => {
  return tagValue.startsWith("/");
};

/**
 * タグ文字列からタグ名を取り出す
 */
const extractTagName = (tagValue: string): string => {
  return tagValue.split(/[\s/]/)[0];
};

/**
 * トークンの配列からツリー構造（DOM木）を組み立てる
 */
export const buildTree = (tokens: Token[]): Node => {
  const root: ElementNode = {
    type: "element",
    tagName: "document",
    children: [],
  };
  const stack: ElementNode[] = [root];

  for (const token of tokens) {
    const currentParent = stack[stack.length - 1];

    if (token.type === "text") {
      currentParent.children.push({ type: "text", content: token.value });
    } else if (isClosingTag(token.value)) {
      if (stack.length > 1) {
        stack.pop();
      }
    } else {
      const tagName = extractTagName(token.value);
      const element: ElementNode = { type: "element", tagName, children: [] };
      currentParent.children.push(element);
      stack.push(element);
    }
  }

  return root;
};
