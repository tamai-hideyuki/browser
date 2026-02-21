import type { Token } from "./types.ts";

export const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  /**
   * HTMLの現在の読み取り位置
   */
  let readPosition = 0;

  const currentCharacter = () => html[readPosition];

  /**
   * 現在の位置がタグの開始 （<） かどうか
   */
  const isAtTagOpen = (): boolean => {
    return currentCharacter() === "<";
  };

  /**
   * タグを読み取り、Tokenとして返す。閉じカッコがなければnullを返す
   */
  const readTag = (): Token | null => {
    const closingBracketIndex = html.indexOf(">", readPosition);
    if (closingBracketIndex === -1) return null;

    const tagContent = html.slice(readPosition + 1, closingBracketIndex);
    readPosition = closingBracketIndex + 1;
    return { type: "tag", value: tagContent };
  };

  /**
   * テキストを読み取り、Tokenとして返す。空白のみの場合はnullを返す
   */
  const readText = (): Token | null => {
    const nextTagOpenIndex = html.indexOf("<", readPosition);
    const hasNextTag = nextTagOpenIndex !== -1;

    const textContent = html.slice(
      readPosition,
      hasNextTag ? nextTagOpenIndex : undefined,
    );
    readPosition = hasNextTag ? nextTagOpenIndex : html.length;

    const isBlank = textContent.trim() === "";
    return isBlank ? null : { type: "text", value: textContent };
  };

  // ここが本体
  while (readPosition < html.length) {
    if (isAtTagOpen()) {
      const token = readTag();
      if (token === null) break;
      tokens.push(token);
    } else {
      const token = readText();
      if (token !== null) {
        tokens.push(token);
      }
    }
  }

  return tokens;
};
