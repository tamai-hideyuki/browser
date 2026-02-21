import { fetchPage } from "./http.ts";
import { tokenize } from "./tokenizer.ts";
import { buildTree } from "./tree.ts";
import { extractText } from "./render.ts";

/**
 * argument vector の略
 * 
 * arg = argument（引数）
 * v = vector（配列・ベクトル）
 * 
 * つまり「引数の配列」という意味
 * これは Node.js 独自の命名ではなく、C言語の main 関数に由来
 */
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
