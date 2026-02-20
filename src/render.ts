import type { Node } from "./types.ts";

const IGNORED_TAGS = new Set(["script", "style"]);

const collectText = (node: Node): string => {
  if (node.type === "text") {
    return node.content;
  }

  if (IGNORED_TAGS.has(node.tagName)) {
    return "";
  }

  return node.children.map(collectText).join(" ");
};

export const extractText = (root: Node): string => {
  return collectText(root).replace(/\s+/g, " ").trim();
};
