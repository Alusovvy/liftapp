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

type RegionShape =
  | { kind: "path"; d: string }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number };

type Region = { muscle: Muscle; shapes: RegionShape[] };

function paths(...d: string[]): RegionShape[] {
  return d.map((value) => ({ kind: "path", d: value }));
}

// Front figure is centred on x=160, back figure is the same silhouette mirrored
// 300 units to the right (x=460) inside one shared 0 0 620 540 canvas.
const MUSCLE_REGIONS: Region[] = [
  {
    muscle: "Shoulders",
    shapes: paths(
      "M126 101 C115 104 109 114 110 126 C111 138 119 145 128 144 C135 134 136 117 132 105 Z",
      "M194 101 C205 104 211 114 210 126 C209 138 201 145 192 144 C185 134 184 117 188 105 Z",
      "M426 101 C415 104 409 114 410 126 C411 138 419 145 428 144 C435 134 436 117 432 105 Z",
      "M494 101 C505 104 511 114 510 126 C509 138 501 145 492 144 C485 134 484 117 488 105 Z",
    ),
  },
  {
    muscle: "Chest",
    shapes: paths(
      "M134 118 C141 108 154 110 159 121 L159 150 C148 153 137 148 132 138 C129 130 130 122 134 118 Z",
      "M186 118 C179 108 166 110 161 121 L161 150 C172 153 183 148 188 138 C191 130 190 122 186 118 Z",
    ),
  },
  {
    muscle: "Biceps",
    shapes: paths(
      "M111 129 C105 140 106 164 113 174 C119 168 121 144 118 132 Z",
      "M209 129 C215 140 214 164 207 174 C201 168 199 144 202 132 Z",
    ),
  },
  {
    muscle: "Core",
    shapes: [
      ...paths(
        "M136 158 C142 153 147 154 150 160 L150 211 C142 208 137 198 136 185 Z",
        "M184 158 C178 153 173 154 170 160 L170 211 C178 208 183 198 184 185 Z",
      ),
      { kind: "rect", x: 151.5, y: 157, width: 7, height: 16, rx: 3 },
      { kind: "rect", x: 161.5, y: 157, width: 7, height: 16, rx: 3 },
      { kind: "rect", x: 151.5, y: 177, width: 7, height: 17, rx: 3 },
      { kind: "rect", x: 161.5, y: 177, width: 7, height: 17, rx: 3 },
      { kind: "rect", x: 151.5, y: 198, width: 7, height: 16, rx: 3 },
      { kind: "rect", x: 161.5, y: 198, width: 7, height: 16, rx: 3 },
      ...paths("M441 190 C448 181 454 179 460 187 C466 179 472 181 479 190 L476 220 L444 220 Z"),
    ],
  },
  {
    muscle: "Quads",
    shapes: paths(
      "M145 273 C137 292 138 323 146 343 L156 326 L157 273 Z",
      "M158 273 L160 326 L170 343 C178 323 179 292 171 273 Z",
    ),
  },
  {
    muscle: "Calves",
    shapes: paths(
      "M146 405 C138 421 141 449 151 460 L158 442 L157 407 Z",
      "M174 405 C182 421 179 449 169 460 L162 442 L163 407 Z",
      "M446 405 C438 421 441 449 451 460 L458 442 L457 407 Z",
      "M474 405 C482 421 479 449 469 460 L462 442 L463 407 Z",
    ),
  },
  {
    muscle: "Back",
    shapes: paths(
      "M439 112 C446 102 454 100 460 110 C466 100 474 102 481 112 L470 137 L460 146 L450 137 Z",
      "M438 133 C445 124 453 126 458 139 L458 193 C446 188 438 173 436 153 Z",
      "M482 133 C475 124 467 126 462 139 L462 193 C474 188 482 173 484 153 Z",
    ),
  },
  {
    muscle: "Triceps",
    shapes: paths(
      "M411 130 C405 142 406 165 413 175 C420 168 422 144 419 132 Z",
      "M509 130 C515 142 514 165 507 175 C500 168 498 144 501 132 Z",
    ),
  },
  {
    muscle: "Glutes",
    shapes: paths(
      "M442 226 C445 213 457 211 460 225 L460 262 C448 259 441 247 442 226 Z",
      "M478 226 C475 213 463 211 460 225 L460 262 C472 259 479 247 478 226 Z",
    ),
  },
  {
    muscle: "Hamstrings",
    shapes: paths(
      "M445 274 C438 295 440 325 448 343 L458 325 L458 273 Z",
      "M462 273 L462 325 L472 343 C480 325 482 295 475 274 Z",
    ),
  },
];

function tonefor(status: string): "good" | "under" | "over" {
  if (status === "In range") return "good";
  if (status === "Below range") return "under";
  return "over";
}

function BodyFigures() {
  return (
    <g className="muscle-map-outline" aria-hidden="true">
      <text className="muscle-map-view-label" x={160} y={22} textAnchor="middle">
        FRONT
      </text>
      <text className="muscle-map-view-label" x={460} y={22} textAnchor="middle">
        BACK
      </text>
      <g className="muscle-map-silhouette">
        <ellipse cx={160} cy={55} rx={22} ry={25} />
        <path d="M147 78 L173 78 L178 95 C189 97 199 102 206 109 C199 128 196 147 195 166 C194 190 187 211 176 229 L174 262 C169 271 151 271 146 262 L144 229 C133 211 126 190 125 166 C124 147 121 128 114 109 C121 102 131 97 142 95 Z" />
        <path d="M121 106 C109 114 104 130 105 147 L109 184 C110 195 106 208 102 220 L96 243 C94 250 97 255 102 256 C108 257 111 252 113 246 L122 211 C126 198 128 186 127 170 L126 132 C126 119 130 109 134 102 Z" />
        <path d="M199 106 C211 114 216 130 215 147 L211 184 C210 195 214 208 218 220 L224 243 C226 250 223 255 218 256 C212 257 209 252 207 246 L198 211 C194 198 192 186 193 170 L194 132 C194 119 190 109 186 102 Z" />
        <path d="M146 260 C136 281 135 318 140 350 L145 397 L142 481 C142 492 147 498 153 498 L160 498 L164 399 L161 351 L161 266 Z" />
        <path d="M174 260 C184 281 185 318 180 350 L175 397 L178 481 C178 492 173 498 167 498 L160 498 L156 399 L159 351 L159 266 Z" />
        <ellipse cx={460} cy={55} rx={22} ry={25} />
        <path d="M447 78 L473 78 L478 95 C489 97 499 102 506 109 C499 128 496 147 495 166 C494 190 487 211 476 229 L474 262 C469 271 451 271 446 262 L444 229 C433 211 426 190 425 166 C424 147 421 128 414 109 C421 102 431 97 442 95 Z" />
        <path d="M421 106 C409 114 404 130 405 147 L409 184 C410 195 406 208 402 220 L396 243 C394 250 397 255 402 256 C408 257 411 252 413 246 L422 211 C426 198 428 186 427 170 L426 132 C426 119 430 109 434 102 Z" />
        <path d="M499 106 C511 114 516 130 515 147 L511 184 C510 195 514 208 518 220 L524 243 C526 250 523 255 518 256 C512 257 509 252 507 246 L498 211 C494 198 492 186 493 170 L494 132 C494 119 490 109 486 102 Z" />
        <path d="M446 260 C436 281 435 318 440 350 L445 397 L442 481 C442 492 447 498 453 498 L460 498 L464 399 L461 351 L461 266 Z" />
        <path d="M474 260 C484 281 485 318 480 350 L475 397 L478 481 C478 492 473 498 467 498 L460 498 L456 399 L459 351 L459 266 Z" />
        <path
          className="muscle-map-contour"
          d="M160 102 L160 256 M146 263 L160 274 L174 263 M160 276 L160 486 M460 102 L460 256 M446 263 L460 274 L474 263 M460 276 L460 486"
        />
      </g>
    </g>
  );
}

export function MuscleMap({ rows, selectedMuscle, onSelectMuscle }: MuscleMapProps) {
  const rowByMuscle = new Map(rows.map((row) => [row.muscle, row]));

  return (
    <div className="muscle-map">
      <svg
        className="muscle-map-figure"
        viewBox="0 0 620 540"
        role="group"
        aria-label="Front and back body map of weekly muscle coverage"
      >
        <BodyFigures />
        {MUSCLE_REGIONS.map((region) => {
          const row = rowByMuscle.get(region.muscle);
          if (!row) return null;
          const tone = tonefor(row.status);
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
                shape.kind === "path" ? (
                  <path key={index} d={shape.d} />
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
            </g>
          );
        })}
      </svg>
      <ul className="muscle-map-legend">
        <li className="tone-good">
          <span aria-hidden="true" /> In range
        </li>
        <li className="tone-under">
          <span aria-hidden="true" /> Below range
        </li>
        <li className="tone-over">
          <span aria-hidden="true" /> Above range
        </li>
      </ul>
    </div>
  );
}
