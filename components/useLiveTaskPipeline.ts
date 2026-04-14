"use client";

import { useMemo } from "react";
import {
  activeBucketIndexFromCompletions,
  agentShortName,
  inferBucketCompletions,
} from "@/lib/live-task-pipeline";

export type LiveStepStatus = "pending" | "active" | "complete";

export type LiveFlowStep = {
  id: string;
  label: string;
  status: LiveStepStatus;
};

type TranscriptLine = { role: string; text: string };

function agentLabel(bucket: string, status: LiveStepStatus): string {
  const name = agentShortName(bucket);
  if (status === "pending") return `${name} agent — queued`;
  if (status === "active")
    return `${name} agent activated — working on this now`;
  return `${name} agent completed`;
}

/**
 * Pipeline: root completes when connected. Bucket steps use transcript-based
 * completion; the highlighted step is the rightmost incomplete bucket (new
 * intents move focus to the latest node until that work reads as done).
 */
export function useLiveTaskPipeline(
  connected: boolean,
  orderedBuckets: string[],
  transcriptLines: TranscriptLine[],
) {
  const completions = useMemo(
    () => inferBucketCompletions(orderedBuckets, transcriptLines),
    [orderedBuckets, transcriptLines],
  );

  const activeBucketIndex = useMemo(
    () => activeBucketIndexFromCompletions(completions),
    [completions],
  );

  const steps: LiveFlowStep[] = useMemo(() => {
    const root: LiveFlowStep = {
      id: "root",
      label: "Voice agent session live",
      status: connected ? "complete" : "pending",
    };
    if (!connected) return [root];

    const bucketSteps: LiveFlowStep[] = orderedBuckets.map((bucket, i) => {
      let status: LiveStepStatus;
      if (completions[i]) status = "complete";
      else if (i === activeBucketIndex) status = "active";
      else status = "pending";
      return {
        id: bucket,
        label: agentLabel(bucket, status),
        status,
      };
    });
    return [root, ...bucketSteps];
  }, [connected, orderedBuckets, completions, activeBucketIndex]);

  return { steps };
}
