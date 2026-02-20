import type { Token } from "./types.ts";

export const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  let readPosition = 0;

  const currentCharacter = () => html[readPosition];

  const isAtTagOpen = (): boolean => {
    return currentCharacter() === "<";
  };

  const readTag = (): Token | null => {
    const closingBracketIndex = html.indexOf(">", readPosition);
    if (closingBracketIndex === -1) return null;

    const tagContent = html.slice(readPosition + 1, closingBracketIndex);
    readPosition = closingBracketIndex + 1;
    return { type: "tag", value: tagContent };
  };

  const readText = (): Token | null => {
    const nextTagOpenIndex = html.indexOf("<", readPosition);
    const hasNextTag = nextTagOpenIndex !== -1;

    const textContent = html.slice(readPosition, hasNextTag ? nextTagOpenIndex : undefined);
    readPosition = hasNextTag ? nextTagOpenIndex : html.length;

    const isBlank = textContent.trim() === "";
    return isBlank ? null : { type: "text", value: textContent };
  };

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
