// src/colors.js
// 🎨 Shared color tag definitions for POI highlighting

export const COLOR_TAGS = [
  "sunrise",
  "sunset",
  "sky",
  "ocean",
  "forest",
  "violet",
  "rose",
  "amber",
  "mint"
];

export function colorClass(tag) {
  if (!tag) return "";
  return `ecgptn-color-tag-${tag}`;
}
