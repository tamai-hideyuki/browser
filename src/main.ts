import { fetchPage } from "./http.ts";
import { tokenize } from "./tokenizer.ts";
import { buildTree } from "./tree.ts";
import { extractText } from "./render.ts";

const url = process.argv[2];

if (!url) {
  console.error("URLを指定してください");
  process.exit(1);
}

const html = await fetchPage(url);
const tokens = tokenize(html);
const tree = buildTree(tokens);
const text = extractText(tree);
console.log(text);
