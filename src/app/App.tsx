import { useEffect, useMemo, useState } from "react";
import { AppShell, type PrimaryView } from "../components/layout/AppShell";
import { DataProblem } from "../components/feedback/DataProblem";
import { BodyNutritionPage } from "../features/body-nutrition/BodyNutritionPage";
import { LibraryPage } from "../features/library/LibraryPage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TodayPage } from "../features/today/TodayPage";
import { TrainPage } from "../features/train/TrainPage";
import {
  completeActiveWorkout,
  createActiveWorkoutDraft,
  type ActiveWorkoutDraft,
} from "../domain/workout/active-workout";
import {
  LiftwiseStorageRepository,
  type StorageLoadResult,
} from "../infrastructure/local-storage/storage-repository";
import { WorkoutDraftRepository } from "../infrastructure/local-storage/workout-draft-repository";

const views: PrimaryView[] = ["today", "train", "progress", "body", "library", "settings"];

function initialView(): PrimaryView {
  const candidate = window.location.hash.replace(/^#/, "") as PrimaryView;
  return views.includes(candidate) ? candidate : "today";
}

export function App() {
  const [view, setView] = useState<PrimaryView>(initialView);
  const repository = useMemo(
    () => new LiftwiseStorageRepository(window.localStorage),
    [],
  );
  const draftRepository = useMemo(
    () => new WorkoutDraftRepository(window.localStorage),
    [],
  );
  const [storageResult] = useState<StorageLoadResult>(() => repository.load());
  const [draftLoadResult] = useState(() => draftRepository.load());
  const [data, setData] = useState(
    storageResult.status === "loaded" ? storageResult.data : null,
  );
  const [workoutDraft, setWorkoutDraft] = useState<ActiveWorkoutDraft | null>(
    draftLoadResult.status === "loaded" ? draftLoadResult.draft : null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => setView(initialView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const label = view === "body" ? "Body & nutrition" : `${view.charAt(0).toUpperCase()}${view.slice(1)}`;
    document.title = `Liftwise · ${label}`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>("#main-content")?.focus());
  }, [view]);

  const navigate = (next: PrimaryView) => {
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    else setView(next);
  };

  if (storageResult.status === "corrupt") {
    return <DataProblem message={storageResult.message} rawRecoveryAvailable />;
  }

  if (storageResult.status === "empty") {
    return (
      <main className="standalone-state" id="main-content">
        <p className="eyebrow">WELCOME TO LIFTWISE</p>
        <h1>Build your first training baseline</h1>
        <p>
          The new interface does not create fictional history. Open the current setup flow,
          create a profile or import your data, then return here.
        </p>
        <a className="button button-primary" href="./index.html">Open setup</a>
      </main>
    );
  }

  if (!data) {
    return <DataProblem message="Validated data became unavailable. Reload the application or open recovery tools." />;
  }

  const persistData = (next: typeof data) => {
    try {
      repository.save(next);
      setData(next);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown storage error";
      setSaveError(`The change was not saved: ${message}`);
      throw error;
    }
  };

  const persistImport = (
    next: typeof data,
    previous: typeof data,
    batchId: string,
  ) => {
    try {
      repository.saveWithImportUndo(next, previous, batchId);
      setData(next);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown storage error";
      setSaveError(`The import was not saved: ${message}`);
      throw error;
    }
  };

  const undoLastImport = () => {
    try {
      const restored = repository.undoLastImport();
      setData(restored);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown undo error";
      setSaveError(`Import undo failed: ${message}`);
      throw error;
    }
  };

  const startWorkout = (routineId?: string) => {
    if (!data) return;
    try {
      const draft = createActiveWorkoutDraft(
        data,
        routineId === undefined ? {} : { routineId },
      );
      draftRepository.save(draft);
      setWorkoutDraft(draft);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown draft error";
      setSaveError(`The workout could not be started: ${message}`);
    }
  };

  const persistWorkoutDraft = (draft: ActiveWorkoutDraft) => {
    try {
      draftRepository.save(draft);
      setWorkoutDraft(draft);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown draft error";
      setSaveError(`The workout draft was not saved: ${message}`);
      throw error;
    }
  };

  const finishWorkout = () => {
    if (!data || !workoutDraft) return;
    try {
      const completed = completeActiveWorkout(data, workoutDraft);
      repository.save(completed.data);
      setData(completed.data);
      draftRepository.clear();
      setWorkoutDraft(null);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workout error";
      setSaveError(`The workout was not finished: ${message}`);
      throw error;
    }
  };

  const discardWorkout = () => {
    try {
      draftRepository.clear();
      setWorkoutDraft(null);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown draft error";
      setSaveError(`The workout draft was not discarded: ${message}`);
      throw error;
    }
  };

  return (
    <AppShell
      activeView={view}
      athleteName={data.profile.name}
      onNavigate={navigate}
    >
      {saveError ? <div className="save-error" role="alert">{saveError}</div> : null}
      {view === "today" ? <TodayPage data={data} onOpenProgress={() => navigate("progress")} /> : null}
      {view === "train" ? (
        <TrainPage
          data={data}
          importUndoAvailable={repository.hasImportUndo()}
          onDataChange={persistData}
          onImportCommit={persistImport}
          onUndoImport={undoLastImport}
          workoutDraft={workoutDraft}
          workoutDraftProblem={draftLoadResult.status === "corrupt" ? draftLoadResult.message : null}
          onStartWorkout={startWorkout}
          onWorkoutDraftChange={persistWorkoutDraft}
          onFinishWorkout={finishWorkout}
          onDiscardWorkout={discardWorkout}
        />
      ) : null}
      {view === "progress" ? <ProgressPage data={data} onOpenTrain={() => navigate("train")} /> : null}
      {view === "body" ? <BodyNutritionPage data={data} /> : null}
      {view === "library" ? <LibraryPage data={data} /> : null}
      {view === "settings" ? <SettingsPage data={data} /> : null}
    </AppShell>
  );
}
