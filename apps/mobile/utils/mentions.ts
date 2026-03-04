export function toMentionHandle(displayName: string): string {
  return displayName.trim().replace(/\s+/g, '_');
}

export function extractTrailingMentionQuery(text: string): string | null {
  const match = text.match(/(?:^|\s)@([a-zA-Z0-9_-]{1,30})$/);
  return match?.[1] ?? null;
}

export function replaceTrailingMention(text: string, mentionHandle: string): string {
  return text.replace(/(^|\s)@[a-zA-Z0-9_-]{1,30}$/, `$1@${mentionHandle} `);
}
