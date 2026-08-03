import { useMemo, useState } from "react";
import {
  EXERCISE_CATALOG,
  isExerciseAvailable,
  type ExerciseCatalogItem,
} from "../../domain/exercises/catalog";
import { MUSCLES, type LiftwiseData } from "../../domain/models/schema";

type LibraryPageProps = {
  data: LiftwiseData;
  onDataChange: (data: LiftwiseData) => void;
};

type LibraryExercise = ExerciseCatalogItem & {
  custom: boolean;
};

export function LibraryPage({ data, onDataChange }: LibraryPageProps) {
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState("All");
  const [muscle, setMuscle] = useState("All");
  const [equipment, setEquipment] = useState("All");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const patterns = ["All", ...new Set([
    ...EXERCISE_CATALOG.map((exercise) => exercise.pattern),
    ...data.customExercises.map((exercise) => exercise.pattern),
  ])];
  const equipmentOptions = ["All", ...new Set([
    ...EXERCISE_CATALOG.flatMap((exercise) => [...exercise.equipment, ...exercise.equipmentAny]),
    ...data.customExercises.flatMap((exercise) => [...exercise.equipment, ...exercise.equipmentAny]),
  ])].sort();
  const recentUse = useMemo(() => {
    const dates = new Map<string, string>();
    data.workouts.forEach((workout) => {
      workout.entries.forEach((entry) => {
        if ((dates.get(entry.exerciseId) ?? "") < workout.date) {
          dates.set(entry.exerciseId, workout.date);
        }
      });
    });
    return dates;
  }, [data.workouts]);
  const appearances = useMemo(() => {
    const counts = new Map<string, number>();
    data.workouts.forEach((workout) => {
      new Set(workout.entries.map((entry) => entry.exerciseId)).forEach((exerciseId) => {
        counts.set(exerciseId, (counts.get(exerciseId) ?? 0) + 1);
      });
    });
    return counts;
  }, [data.workouts]);
  const routineUse = useMemo(() => {
    const names = new Map<string, string[]>();
    data.routines.forEach((routine) => {
      routine.entries.forEach((entry) => {
        names.set(entry.exerciseId, [...(names.get(entry.exerciseId) ?? []), routine.name]);
      });
    });
    return names;
  }, [data.routines]);
  const allExercises: LibraryExercise[] = [
    ...EXERCISE_CATALOG.map((exercise) => ({ ...exercise, custom: false })),
    ...data.customExercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      primary: exercise.primary,
      secondary: exercise.secondary,
      pattern: exercise.pattern,
      type: exercise.type,
      equipment: exercise.equipment,
      equipmentAny: exercise.equipmentAny,
      machine: exercise.machine,
      swapId: exercise.swapId,
      homeReplacementId: exercise.homeReplacementId,
      custom: true,
    })),
  ];
  const exercises = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const catalogOrder = new Map(allExercises.map((exercise, index) => [exercise.id, index]));
    return allExercises.filter((exercise) => {
      const available = isExerciseAvailable(exercise, data.profile.equipment);
      return (
        (!normalized
          || exercise.name.toLowerCase().includes(normalized)
          || exercise.primary.join(" ").toLowerCase().includes(normalized)
          || exercise.secondary.join(" ").toLowerCase().includes(normalized))
        && (pattern === "All" || exercise.pattern === pattern)
        && (muscle === "All" || exercise.primary.includes(muscle as (typeof MUSCLES)[number]))
        && (equipment === "All"
          || exercise.equipment.includes(equipment)
          || exercise.equipmentAny.includes(equipment))
        && (!favoriteOnly || data.favoriteExercises.includes(exercise.id))
        && (!data.libraryPreferences.availableOnly || available)
      );
    }).sort((left, right) => {
      if (data.libraryPreferences.sort === "alphabetical") {
        return left.name.localeCompare(right.name);
      }
      if (data.libraryPreferences.sort === "recent") {
        return (recentUse.get(right.id) ?? "").localeCompare(recentUse.get(left.id) ?? "")
          || left.name.localeCompare(right.name);
      }
      return (catalogOrder.get(left.id) ?? 0) - (catalogOrder.get(right.id) ?? 0);
    });
  }, [
    allExercises,
    data.favoriteExercises,
    data.libraryPreferences.availableOnly,
    data.libraryPreferences.sort,
    data.profile.equipment,
    equipment,
    favoriteOnly,
    muscle,
    pattern,
    query,
    recentUse,
  ]);

  const updatePreferences = (patch: Partial<LiftwiseData["libraryPreferences"]>) => {
    onDataChange({
      ...data,
      libraryPreferences: { ...data.libraryPreferences, ...patch },
    });
  };
  const toggleFavorite = (exerciseId: string) => {
    const favorite = data.favoriteExercises.includes(exerciseId);
    onDataChange({
      ...data,
      favoriteExercises: favorite
        ? data.favoriteExercises.filter((id) => id !== exerciseId)
        : [...data.favoriteExercises, exerciseId],
    });
  };
  const activeFilters = [
    pattern !== "All" ? { label: pattern, clear: () => setPattern("All") } : null,
    muscle !== "All" ? { label: `${muscle} · direct`, clear: () => setMuscle("All") } : null,
    equipment !== "All" ? { label: equipment, clear: () => setEquipment("All") } : null,
    favoriteOnly ? { label: "Favorites", clear: () => setFavoriteOnly(false) } : null,
    data.libraryPreferences.availableOnly
      ? { label: "Available now", clear: () => updatePreferences({ availableOnly: false }) }
      : null,
  ].filter((item): item is { label: string; clear: () => void } => item !== null);

  return (
    <div className="page">
      <header className="page-header library-heading">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Choose by role and constraints</h1>
          <p className="page-intro">
            Availability, familiarity, and the role in your plan are shown—never a universal “best” score.
          </p>
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

      <section className="library-controls" aria-label="Exercise filters and display">
        <label>
          <span>Movement pattern</span>
          <select value={pattern} onChange={(event) => setPattern(event.target.value)}>
            {patterns.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Primary muscle</span>
          <select value={muscle} onChange={(event) => setMuscle(event.target.value)}>
            <option>All</option>
            {MUSCLES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Equipment</span>
          <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            {equipmentOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={data.libraryPreferences.sort}
            onChange={(event) => updatePreferences({
              sort: event.target.value as LiftwiseData["libraryPreferences"]["sort"],
            })}
          >
            <option value="recent">Recently used</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="catalog">Catalog order</option>
          </select>
        </label>
        <button
          type="button"
          className={favoriteOnly ? "filter-toggle active" : "filter-toggle"}
          aria-pressed={favoriteOnly}
          onClick={() => setFavoriteOnly((current) => !current)}
        >
          Favorites
        </button>
        <button
          type="button"
          className={data.libraryPreferences.availableOnly ? "filter-toggle active" : "filter-toggle"}
          aria-pressed={data.libraryPreferences.availableOnly}
          onClick={() => updatePreferences({
            availableOnly: !data.libraryPreferences.availableOnly,
          })}
        >
          Available now
        </button>
      </section>

      <div className="library-result-row">
        <div className="active-filter-chips" aria-label="Active filters">
          {activeFilters.map((filter) => (
            <button key={filter.label} type="button" onClick={filter.clear}>
              {filter.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
        <div className="density-controls">
          <span>Density</span>
          <button
            type="button"
            aria-pressed={data.libraryPreferences.density === "comfortable"}
            onClick={() => updatePreferences({ density: "comfortable" })}
          >
            Comfortable
          </button>
          <button
            type="button"
            aria-pressed={data.libraryPreferences.density === "compact"}
            onClick={() => updatePreferences({ density: "compact" })}
          >
            Compact
          </button>
        </div>
      </div>

      <p className="result-count" aria-live="polite">{exercises.length} matching exercises</p>
      {exercises.length ? (
        <div className={`library-grid-modern density-${data.libraryPreferences.density}`}>
          {exercises.map((exercise) => {
            const available = isExerciseAvailable(exercise, data.profile.equipment);
            const favorite = data.favoriteExercises.includes(exercise.id);
            const usedIn = routineUse.get(exercise.id) ?? [];
            const count = appearances.get(exercise.id) ?? 0;
            return (
              <article key={exercise.id} className={!available ? "unavailable" : ""}>
                <div className="library-card-top">
                  <span>{exercise.custom ? "Custom" : exercise.pattern}</span>
                  <button
                    className="favorite-button"
                    type="button"
                    aria-pressed={favorite}
                    aria-label={`${favorite ? "Remove" : "Add"} ${exercise.name} ${favorite ? "from" : "to"} favorites`}
                    onClick={() => toggleFavorite(exercise.id)}
                  >
                    <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
                  </button>
                </div>
                <h2>{exercise.name}</h2>
                <p>{exercise.type} · {exercise.primary.join(", ") || "Outside current coverage model"}</p>
                <div className="tag-list">
                  {exercise.primary.map((item) => <span key={item}>{item} · direct</span>)}
                  {exercise.secondary.map((item) => <span key={item}>{item} · secondary</span>)}
                </div>
                <div className={available ? "availability-note available" : "availability-note"}>
                  <strong>{available ? "Available with your equipment" : "Additional equipment needed"}</strong>
                  <span>
                    {exercise.equipment.length
                      ? exercise.equipment.join(" + ")
                      : exercise.equipmentAny.length ? exercise.equipmentAny.join(" or ") : "Bodyweight"}
                  </span>
                </div>
                <details>
                  <summary>Why this may fit</summary>
                  <dl>
                    <div><dt>Familiarity</dt><dd>{count ? `${count} logged appearance${count === 1 ? "" : "s"}` : "No baseline yet"}</dd></div>
                    <div><dt>Last used</dt><dd>{recentUse.get(exercise.id) ?? "Not logged"}</dd></div>
                    <div><dt>Routines</dt><dd>{usedIn.length ? usedIn.join(", ") : "Not in a routine"}</dd></div>
                    <div><dt>Role</dt><dd>{exercise.pattern}</dd></div>
                  </dl>
                </details>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="positive-empty">
          <strong>No exercise matches every current filter.</strong>
          <p>Remove one filter or search for a broader muscle or movement name.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setQuery("");
              setPattern("All");
              setMuscle("All");
              setEquipment("All");
              setFavoriteOnly(false);
              updatePreferences({ availableOnly: false });
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
