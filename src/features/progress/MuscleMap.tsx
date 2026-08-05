import { useState } from "react";
import type { Muscle } from "../../domain/models/schema";

export type MuscleMapRow = {
  muscle: Muscle;
  minimum: number;
  maximum: number;
  value: number;
  status: string;
};

type MuscleMapProps = {
  rows: MuscleMapRow[];
  selectedMuscle: Muscle | null;
  onSelectMuscle: (muscle: Muscle) => void;
};

type BodyView = "front" | "back";

type RegionShape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number };

type Region = { muscle: Muscle; shapes: RegionShape[]; labelX: number; labelY: number };

const SHOULDERS: RegionShape[] = [
  { kind: "ellipse", cx: 41, cy: 78, rx: 13, ry: 16 },
  { kind: "ellipse", cx: 159, cy: 78, rx: 13, ry: 16 },
];

const CALVES: RegionShape[] = [
  { kind: "ellipse", cx: 83, cy: 292, rx: 11, ry: 30 },
  { kind: "ellipse", cx: 117, cy: 292, rx: 11, ry: 30 },
];

const FRONT_REGIONS: Region[] = [
  { muscle: "Shoulders", shapes: SHOULDERS, labelX: 100, labelY: 78 },
  {
    muscle: "Chest",
    shapes: [{ kind: "ellipse", cx: 100, cy: 100, rx: 32, ry: 22 }],
    labelX: 100,
    labelY: 100,
  },
  {
    muscle: "Biceps",
    shapes: [
      { kind: "ellipse", cx: 41, cy: 150, rx: 12, ry: 28 },
      { kind: "ellipse", cx: 159, cy: 150, rx: 12, ry: 28 },
    ],
    labelX: 100,
    labelY: 150,
  },
  {
    muscle: "Core",
    shapes: [{ kind: "rect", x: 75, y: 130, width: 50, height: 45, rx: 12 }],
    labelX: 100,
    labelY: 152,
  },
  {
    muscle: "Quads",
    shapes: [
      { kind: "rect", x: 74, y: 185, width: 18, height: 80, rx: 9 },
      { kind: "rect", x: 108, y: 185, width: 18, height: 80, rx: 9 },
    ],
    labelX: 100,
    labelY: 225,
  },
  { muscle: "Calves", shapes: CALVES, labelX: 100, labelY: 292 },
];

const BACK_REGIONS: Region[] = [
  { muscle: "Shoulders", shapes: SHOULDERS, labelX: 100, labelY: 78 },
  {
    muscle: "Back",
    shapes: [{ kind: "rect", x: 68, y: 64, width: 64, height: 70, rx: 18 }],
    labelX: 100,
    labelY: 99,
  },
  {
    muscle: "Triceps",
    shapes: [
      { kind: "ellipse", cx: 41, cy: 150, rx: 12, ry: 28 },
      { kind: "ellipse", cx: 159, cy: 150, rx: 12, ry: 28 },
    ],
    labelX: 100,
    labelY: 150,
  },
  {
    muscle: "Glutes",
    shapes: [{ kind: "ellipse", cx: 100, cy: 178, rx: 36, ry: 22 }],
    labelX: 100,
    labelY: 178,
  },
  {
    muscle: "Hamstrings",
    shapes: [
      { kind: "rect", x: 74, y: 200, width: 18, height: 65, rx: 9 },
      { kind: "rect", x: 108, y: 200, width: 18, height: 65, rx: 9 },
    ],
    labelX: 100,
    labelY: 232,
  },
  { muscle: "Calves", shapes: CALVES, labelX: 100, labelY: 292 },
];

function toneFor(status: string): "good" | "review" {
  return status === "In range" ? "good" : "review";
}

function glyphFor(status: string): string {
  if (status === "In range") return "✓";
  if (status === "Below range") return "+";
  return "−";
}

function Outline() {
  return (
    <g className="muscle-map-outline" aria-hidden="true">
      <circle cx={100} cy={30} r={20} />
      <rect x={92} y={48} width={16} height={12} />
      <rect x={62} y={58} width={76} height={120} rx={26} />
      <rect x={30} y={64} width={22} height={130} rx={11} />
      <rect x={148} y={64} width={22} height={130} rx={11} />
      <rect x={70} y={176} width={26} height={150} rx={13} />
      <rect x={104} y={176} width={26} height={150} rx={13} />
    </g>
  );
}

export function MuscleMap({ rows, selectedMuscle, onSelectMuscle }: MuscleMapProps) {
  const [view, setView] = useState<BodyView>("front");
  const rowByMuscle = new Map(rows.map((row) => [row.muscle, row]));
  const regions = view === "front" ? FRONT_REGIONS : BACK_REGIONS;

  return (
    <div className="muscle-map">
      <div className="muscle-map-toggle" role="group" aria-label="Body map view">
        <button
          type="button"
          className={view === "front" ? "is-active" : ""}
          aria-pressed={view === "front"}
          onClick={() => setView("front")}
        >
          Front
        </button>
        <button
          type="button"
          className={view === "back" ? "is-active" : ""}
          aria-pressed={view === "back"}
          onClick={() => setView("back")}
        >
          Back
        </button>
      </div>
      <svg
        className="muscle-map-figure"
        viewBox="0 0 200 340"
        role="group"
        aria-label={`${view === "front" ? "Front" : "Back"} body map of weekly muscle coverage`}
      >
        <Outline />
        {regions.map((region) => {
          const row = rowByMuscle.get(region.muscle);
          if (!row) return null;
          const tone = toneFor(row.status);
          const selected = selectedMuscle === region.muscle;
          const label = `${region.muscle}: ${row.status}, ${row.value} of ${row.minimum}-${row.maximum} weekly sets`;
          return (
            <g
              key={region.muscle}
              className={`muscle-region tone-${tone} ${selected ? "is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={label}
              onClick={() => onSelectMuscle(region.muscle)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectMuscle(region.muscle);
                }
              }}
            >
              <title>{label}</title>
              {region.shapes.map((shape, index) =>
                shape.kind === "ellipse" ? (
                  <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
                ) : (
                  <rect
                    key={index}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    rx={shape.rx}
                  />
                ),
              )}
              <text x={region.labelX} y={region.labelY} textAnchor="middle" aria-hidden="true">
                {glyphFor(row.status)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="muscle-map-legend">
        <li className="tone-good">
          <span aria-hidden="true">✓</span> In range
        </li>
        <li className="tone-review">
          <span aria-hidden="true">+</span> Below range
        </li>
        <li className="tone-review">
          <span aria-hidden="true">−</span> Above range
        </li>
      </ul>
    </div>
  );
}
