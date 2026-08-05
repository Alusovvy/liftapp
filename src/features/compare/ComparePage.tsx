import { useEffect, useState } from "react";
import { MUSCLES, type Muscle } from "../../domain/models/schema";
import { fetchComparison, type CompareRow } from "../../infrastructure/remote/compare-client";

type CompareMetric = Muscle | "sessions";

const METRIC_OPTIONS: Array<{ id: CompareMetric; label: string; unit: string }> = [
  { id: "sessions", label: "Sessions this week", unit: "session" },
  ...MUSCLES.map((muscle) => ({
    id: muscle,
    label: `${muscle} weekly sets`,
    unit: "weighted set",
  })),
];

function valueFor(row: CompareRow, metric: CompareMetric): number {
  return metric === "sessions" ? row.sessions : row.doses[metric];
}

function weekLabel(weekStart: string, weekEndExclusive: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEndExclusive}T12:00:00`);
  end.setDate(end.getDate() - 1);
  const format = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${format.format(start)} – ${format.format(end)}`;
}

export function ComparePage() {
  const [result, setResult] = useState<{
    weekStart: string;
    weekEnd: string;
    rows: CompareRow[];
  } | null>(null);
  const [metric, setMetric] = useState<CompareMetric>("sessions");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchComparison()
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load the comparison.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOption = METRIC_OPTIONS.find((option) => option.id === metric);
  const rows = result?.rows ?? [];
  const ranked = [...rows].sort(
    (first, second) => valueFor(second, metric) - valueFor(first, metric),
  );
  const maxValue = Math.max(1, ...rows.map((row) => valueFor(row, metric)));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {result ? weekLabel(result.weekStart, result.weekEnd) : "Compare"}
          </p>
          <h1>See how the group's week is going</h1>
          <p className="page-intro">
            Current-week numbers only, visible to everyone in this group. Not a ranking of who is
            training correctly — the same weekly counts you already see for yourself.
          </p>
        </div>
      </header>

      <label className="compare-metric-picker">
        <span>Compare</span>
        <select value={metric} onChange={(event) => setMetric(event.target.value as CompareMetric)}>
          {METRIC_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <div className="import-error" role="alert">
          <strong>Could not load the comparison</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {!result && !error ? <p className="empty-copy">Loading comparison…</p> : null}

      {result && rows.length ? (
        <div
          className="muscle-bars compare-bars"
          role="list"
          aria-label={`${selectedOption?.label ?? "Comparison"} by person`}
        >
          {ranked.map((row) => {
            const value = valueFor(row, metric);
            return (
              <div className="muscle-bar-row" role="listitem" key={row.username}>
                <div className="muscle-bar-label">
                  <strong>{row.username}</strong>
                  <span>
                    {value} {selectedOption?.unit}
                    {value === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="muscle-track" aria-hidden="true">
                  <span
                    className="actual-bar"
                    style={{ width: `${Math.min(100, (value / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {result && !rows.length ? (
        <div className="positive-empty">
          <strong>No accounts to compare yet.</strong>
          <p>Once a friend has an account, their current week appears here.</p>
        </div>
      ) : null}

      <p className="method-note">
        Weekly sets use the same 1.0 direct / 0.5 secondary credit shown in your own Progress ›
        Muscles view. This is a planning heuristic, not a fitness or health judgment.
      </p>
    </div>
  );
}
