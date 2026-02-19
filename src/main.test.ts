import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("main", () => {
  it("URLありで実行するとHTMLが出力される", () => {
    const output = execSync("npx tsx src/main.ts https://example.com", {
      encoding: "utf-8",
    });
    expect(output).toContain("<html");
  });

  it("URLなしで実行するとエラーメッセージを出して終了する", () => {
    try {
      execSync("npx tsx src/main.ts", { encoding: "utf-8" });
      expect.unreachable();
    } catch (e: any) {
      expect(e.stderr).toContain("URLを指定してください");
      expect(e.status).toBe(1);
    }
  });
});
