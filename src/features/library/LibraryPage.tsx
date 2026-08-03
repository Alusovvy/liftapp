import { useMemo, useState } from "react";
import { EXERCISE_CATALOG, isExerciseAvailable } from "../../domain/exercises/catalog";
import type { LiftwiseData } from "../../domain/models/schema";

type LibraryPageProps = {
  data: LiftwiseData;
};

export function LibraryPage({ data }: LibraryPageProps) {
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState("All");
  const patterns = ["All", ...new Set(EXERCISE_CATALOG.map((exercise) => exercise.pattern))];
  const exercises = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return EXERCISE_CATALOG.filter((exercise) => (
      (!normalized
        || exercise.name.toLowerCase().includes(normalized)
        || exercise.primary.join(" ").toLowerCase().includes(normalized))
      && (pattern === "All" || exercise.pattern === pattern)
    ));
  }, [pattern, query]);

  return (
    <div className="page">
      <header className="page-header library-heading">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Choose by role and constraints</h1>
          <p className="page-intro">No universal “best exercise” score.</p>
        </div>
        <label className="search-field">
          <span>Search exercises</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or muscle"
          />
        </label>
      </header>
      <div className="pattern-filters" aria-label="Movement pattern">
        {patterns.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={pattern === item}
            onClick={() => setPattern(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="result-count" aria-live="polite">{exercises.length} matching exercises</p>
      <div className="library-grid-modern">
        {exercises.map((exercise) => {
          const available = isExerciseAvailable(exercise, data.profile.equipment);
          return (
            <article key={exercise.id} className={!available ? "unavailable" : ""}>
              <div className="library-card-top">
                <span>{exercise.pattern}</span>
                <span className={available ? "availability-yes" : "availability-no"}>
                  {available ? "Available" : "Equipment needed"}
                </span>
              </div>
              <h2>{exercise.name}</h2>
              <p>{exercise.type} · {exercise.primary.join(", ") || "Outside current coverage model"}</p>
              <div className="tag-list">
                {exercise.primary.map((muscle) => <span key={muscle}>{muscle} · direct</span>)}
                {exercise.secondary.map((muscle) => <span key={muscle}>{muscle} · secondary</span>)}
              </div>
              <small>
                {exercise.equipment.length
                  ? exercise.equipment.join(" + ")
                  : exercise.equipmentAny.length ? exercise.equipmentAny.join(" or ") : "Bodyweight"}
              </small>
            </article>
          );
        })}
      </div>
    </div>
  );
}
