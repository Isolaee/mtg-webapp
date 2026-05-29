import type { MinigameAggregate, MinigameDetail } from "../../api";

/** Props every minigame renderer receives. New game types implement this contract. */
export interface MinigameRendererProps {
  detail: MinigameDetail;
  /** Cast a vote for an option; resolves once the updated aggregate is stored. */
  onVote: (optionId: number) => Promise<void>;
  /** The community aggregate to reveal, or null before the user has voted. */
  result: MinigameAggregate | null;
  /** The option the user chose, or null if they haven't voted yet. */
  votedOptionId: number | null;
  /** True while a vote request is in flight. */
  voting: boolean;
}
