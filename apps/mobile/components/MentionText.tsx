import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

interface MentionTextProps {
  text: string;
  baseStyle: StyleProp<TextStyle>;
  mentionStyle: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const mentionRegex = /(^|\s)(@[a-zA-Z0-9_-]{2,30})/g;

export default function MentionText({
  text,
  baseStyle,
  mentionStyle,
  numberOfLines,
}: MentionTextProps) {
  const segments: Array<{ text: string; mention: boolean }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(mentionRegex)) {
    const fullMatch = match[0] ?? '';
    const handle = match[2] ?? '';
    const matchStart = typeof match.index === 'number' ? match.index : -1;

    if (matchStart < 0) continue;

    const prefixLength = fullMatch.length - handle.length;
    const handleStart = matchStart + prefixLength;

    if (handleStart > lastIndex) {
      segments.push({ text: text.slice(lastIndex, handleStart), mention: false });
    }

    segments.push({ text: handle, mention: true });
    lastIndex = handleStart + handle.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), mention: false });
  }

  if (segments.length === 0) {
    return (
      <Text style={baseStyle} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={baseStyle} numberOfLines={numberOfLines}>
      {segments.map((segment, index) => (
        <Text
          key={`${segment.mention ? 'm' : 't'}-${index}`}
          style={segment.mention ? mentionStyle : undefined}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
