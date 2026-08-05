import type { Muscle } from "../../domain/models/schema";

export type CompareRow = {
  username: string;
  sessions: number;
  doses: Record<Muscle, number>;
};

export type CompareResult = {
  weekStart: string;
  weekEnd: string;
  rows: CompareRow[];
};

export async function fetchComparison(): Promise<CompareResult> {
  const response = await fetch("/api/compare", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Could not load the comparison (server error ${response.status}).`);
  }
  return (await response.json()) as CompareResult;
}
