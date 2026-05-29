import React, { useEffect, useState } from "react";
import {
  fetchMinigame,
  voteMinigame,
  type MinigameAggregate,
  type MinigameDetail,
} from "../../api";
import { getVotedOption, getVoterKey, rememberVote } from "../../utils/voterKey";
import { T } from "../../theme";
import { getRenderer } from "./registry";

interface Props {
  minigameId: number;
  /** Optional preloaded detail to skip the initial fetch. */
  detail?: MinigameDetail;
}

// Shared wrapper used by both the Minigames page and the HomePage widget:
// fetches a minigame, looks up its renderer, and owns vote/reveal state.
const MinigameCard: React.FC<Props> = ({ minigameId, detail: preloaded }) => {
  const [detail, setDetail] = useState<MinigameDetail | null>(preloaded ?? null);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<MinigameAggregate | null>(null);
  const [votedOptionId, setVotedOptionId] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let active = true;
    const prior = getVotedOption(minigameId);

    const apply = (d: MinigameDetail) => {
      if (!active) return;
      setDetail(d);
      if (prior !== null) {
        setVotedOptionId(prior);
        setResult(d.aggregate);
      }
    };

    if (preloaded) {
      apply(preloaded);
    } else {
      fetchMinigame(minigameId)
        .then(apply)
        .catch(() => active && setError(true));
    }
    return () => {
      active = false;
    };
  }, [minigameId, preloaded]);

  const handleVote = async (optionId: number) => {
    if (voting || result !== null) return;
    setVoting(true);
    try {
      const agg = await voteMinigame(minigameId, optionId, getVoterKey());
      rememberVote(minigameId, optionId);
      setVotedOptionId(optionId);
      setResult(agg);
    } catch {
      setError(true);
    } finally {
      setVoting(false);
    }
  };

  if (error) {
    return null;
  }
  if (!detail) {
    return <p style={{ color: T.textDim }}>Loading minigame…</p>;
  }

  const Renderer = getRenderer(detail.type);
  if (!Renderer) {
    return null;
  }

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.borderGold}44`,
        borderRadius: 6,
        padding: "1.4em 1.6em",
      }}
    >
      <Renderer
        detail={detail}
        onVote={handleVote}
        result={result}
        votedOptionId={votedOptionId}
        voting={voting}
      />
    </div>
  );
};

export default MinigameCard;
