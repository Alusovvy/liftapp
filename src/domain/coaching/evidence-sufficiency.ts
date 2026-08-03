import type { EvidenceState } from "./types";

export type EvidenceInput = {
  observations: number;
  requiredObservations: number;
  hasBaseline: boolean;
};

export function classifyEvidence({
  observations,
  requiredObservations,
  hasBaseline,
}: EvidenceInput): EvidenceState {
  if (!hasBaseline || observations <= 0) return "need-data";
  if (observations < requiredObservations) return "emerging";
  return "enough-evidence";
}

export function evidenceLabel(state: EvidenceState): string {
  if (state === "need-data") return "Need data";
  if (state === "emerging") return "Emerging";
  return "Enough evidence";
}
