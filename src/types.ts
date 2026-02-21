export type Node = TextNode | ElementNode;

export type ElementNode = {
  type: "element";
  tagName: string;
  children: Node[];
};

type TextNode = {
  type: "text";
  content: string;
};

export type Token =
  | { type: "tag"; value: string }
  | { type: "text"; value: string };
