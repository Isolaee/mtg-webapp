import type React from "react";
import SelectOneGame from "./SelectOneGame";
import type { MinigameRendererProps } from "./types";

// Maps a minigame `type` to its renderer. Add a new game type here + a renderer file —
// no page changes required.
export const MINIGAME_RENDERERS: Record<string, React.FC<MinigameRendererProps>> = {
  select_one: SelectOneGame,
};

export function getRenderer(type: string): React.FC<MinigameRendererProps> | null {
  return MINIGAME_RENDERERS[type] ?? null;
}
