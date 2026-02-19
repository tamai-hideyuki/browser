import { fetchPage } from "./http.js";

const url = process.argv[2];

if (!url) {
  console.error("URLを指定してください");
  process.exit(1);
}

const html = await fetchPage(url);
console.log(html);
