// src/types.ts

export type Character = {
  id: string;
  name: string;
  color: string; // CSS hex color, e.g. "#FF6B6B"
};

export type Line = {
  id: string;
  characterId: string;
  text: string;
};

export type Project = {
  version: 1;
  projectName: string;
  characters: Character[];
  lines: Line[];
};
