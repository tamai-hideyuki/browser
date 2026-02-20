type TextNode = {
  type: "text";
  content: string;
};

export type ElementNode = {
  type: "element";
  tagName: string;
  children: Node[];
};

export type Node = TextNode | ElementNode;

export type Token =
  | { type: "tag"; value: string }
  | { type: "text"; value: string };
