import { useEffect, useMemo, useState } from "react";
import { AppShell, type PrimaryView } from "../components/layout/AppShell";
import { DataProblem } from "../components/feedback/DataProblem";
import { LoginPage } from "../features/auth/LoginPage";
import { BodyNutritionPage } from "../features/body-nutrition/BodyNutritionPage";
import { ComparePage } from "../features/compare/ComparePage";
import { LibraryPage } from "../features/library/LibraryPage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TodayPage } from "../features/today/TodayPage";
import { TrainPage, type TrainTab } from "../features/train/TrainPage";
import {
  completeActiveWorkout,
  createActiveWorkoutDraft,
  type ActiveWorkoutDraft,
} from "../domain/workout/active-workout";
import { createDefaultLiftwiseData, type LiftwiseData } from "../domain/models/schema";
import { fetchSession, logout } from "../infrastructure/remote/auth-client";
import { RemoteStorageRepository } from "../infrastructure/remote/storage-repository";
import { WorkoutDraftRepository } from "../infrastructure/local-storage/workout-draft-repository";

const views: PrimaryView[] = [
  "today",
  "train",
  "progress",
  "body",
  "library",
  "compare",
  "settings",
];

function initialView(): PrimaryView {
  const candidate = window.location.hash.replace(/^#/, "") as PrimaryView;
  return views.includes(candidate) ? candidate : "today";
}

type AuthState =
  { phase: "checking" } | { phase: "signed-out" } | { phase: "signed-in"; username: string };

type LoadState =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "loaded" }
  | { phase: "corrupt"; message: string }
  | { phase: "error"; message: string };

export function App() {
  const [view, setView] = useState<PrimaryView>(initialView);
  const [trainInitialTab, setTrainInitialTab] = useState<TrainTab | undefined>(undefined);
  const repository = useMemo(() => new RemoteStorageRepository(), []);
  const draftRepository = useMemo(() => new WorkoutDraftRepository(window.localStorage), []);

  const [auth, setAuth] = useState<AuthState>({ phase: "checking" });
  const [loadState, setLoadState] = useState<LoadState>({ phase: "loading" });
  const [data, setData] = useState<LiftwiseData | null>(null);
  const [importUndoAvailable, setImportUndoAvailable] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<ActiveWorkoutDraft | null>(null);
  const [workoutDraftProblem, setWorkoutDraftProblem] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSession().then((session) => {
      if (cancelled) return;
      setAuth(
        session.authenticated
          ? { phase: "signed-in", username: session.username }
          : { phase: "signed-out" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (auth.phase !== "signed-in") return;
    let cancelled = false;
    setLoadState({ phase: "loading" });

    repository.load().then((result) => {
      if (cancelled) return;
      if (result.status === "unauthenticated") {
        setAuth({ phase: "signed-out" });
        return;
      }
      if (result.status === "empty") {
        setLoadState({ phase: "empty" });
        return;
      }
      if (result.status === "corrupt") {
        setLoadState({ phase: "corrupt", message: result.message });
        return;
      }
      if (result.status === "error") {
        setLoadState({ phase: "error", message: result.message });
        return;
      }
      setData(result.data);
      setLoadState({ phase: "loaded" });
    });

    repository.hasImportUndo().then((available) => {
      if (!cancelled) setImportUndoAvailable(available);
    });

    const draftResult = draftRepository.load();
    setWorkoutDraft(draftResult.status === "loaded" ? draftResult.draft : null);
    setWorkoutDraftProblem(draftResult.status === "corrupt" ? draftResult.message : null);

    return () => {
      cancelled = true;
    };
  }, [auth.phase, repository, draftRepository]);

  useEffect(() => {
    const onHashChange = () => setView(initialView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (auth.phase !== "signed-in" || loadState.phase !== "loaded") return;
    const label =
      view === "body" ? "Body & nutrition" : `${view.charAt(0).toUpperCase()}${view.slice(1)}`;
    document.title = `Liftwise · ${label}`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>("#main-content")?.focus());
  }, [view, auth.phase, loadState.phase]);

  const navigate = (next: PrimaryView) => {
    setTrainInitialTab(undefined);
    if (window.location.hash !== `#${next}`) window.location.hash = next;
    else setView(next);
  };

  const openTrainTab = (tab: TrainTab) => {
    navigate("train");
    setTrainInitialTab(tab);
  };

  if (auth.phase === "checking") {
    return (
      <main className="standalone-state" id="main-content">
        <p className="eyebrow">LIFTWISE</p>
        <h1>Loading…</h1>
      </main>
    );
  }

  if (auth.phase === "signed-out") {
    return <LoginPage onSignedIn={(username) => setAuth({ phase: "signed-in", username })} />;
  }

  if (loadState.phase === "loading") {
    return (
      <main className="standalone-state" id="main-content">
        <p className="eyebrow">LIFTWISE</p>
        <h1>Loading your data…</h1>
      </main>
    );
  }

  if (loadState.phase === "error") {
    return (
      <main className="standalone-state" id="main-content">
        <p className="eyebrow">CONNECTION PROBLEM</p>
        <h1>Could not load your data</h1>
        <p>{loadState.message}</p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setAuth({ phase: "signed-in", username: auth.username })}
        >
          Try again
        </button>
      </main>
    );
  }

  if (loadState.phase === "corrupt") {
    return <DataProblem message={loadState.message} />;
  }

  const persistData = async (next: LiftwiseData) => {
    try {
      await repository.save(next);
      setData(next);
      setLoadState({ phase: "loaded" });
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown storage error";
      setSaveError(`The change was not saved: ${message}`);
    }
  };

  if (loadState.phase === "empty") {
    return (
      <main className="standalone-state" id="main-content">
        <p className="eyebrow">WELCOME TO LIFTWISE, {auth.username.toUpperCase()}</p>
        <h1>Build your first training baseline</h1>
        <p>
          Your account has no saved data yet. Start with a default profile — you can adjust units,
          equipment, and targets afterward.
        </p>
        {saveError ? (
          <div className="save-error" role="alert">
            {saveError}
          </div>
        ) : null}
        <button
          className="button button-primary"
          type="button"
          onClick={() => persistData(createDefaultLiftwiseData(auth.username))}
        >
          Create starter profile
        </button>
      </main>
    );
  }

  if (!data) {
    return (
      <DataProblem message="Validated data became unavailable. Reload the application or try again." />
    );
  }

  const persistImport = async (next: LiftwiseData, previous: LiftwiseData, batchId: string) => {
    try {
      await repository.saveWithImportUndo(next, previous, batchId);
      setData(next);
      setImportUndoAvailable(true);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown storage error";
      setSaveError(`The import was not saved: ${message}`);
      throw error;
    }
  };

  const undoLastImport = async () => {
    try {
      const restored = await repository.undoLastImport();
      setData(restored);
      setImportUndoAvailable(false);
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
      const draft = createActiveWorkoutDraft(data, routineId === undefined ? {} : { routineId });
      draftRepository.save(draft);
      setWorkoutDraft(draft);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown draft error";
      setSaveError(`The workout could not be started: ${message}`);
    }
  };

  const startWorkoutAndGoToTrain = (routineId?: string) => {
    startWorkout(routineId);
    navigate("train");
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

  const finishWorkout = async () => {
    if (!data || !workoutDraft) return;
    try {
      const completed = completeActiveWorkout(data, workoutDraft);
      await repository.save(completed.data);
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

  const exportBackup = async () => {
    try {
      const serialized = await repository.export();
      const blob = new Blob([serialized], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `liftwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export error";
      setSaveError(`The backup could not be exported: ${message}`);
    }
  };

  const restoreBackup = async (restored: LiftwiseData) => {
    try {
      await repository.save(restored);
      draftRepository.clear();
      setWorkoutDraft(null);
      setData(restored);
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown restore error";
      setSaveError(`The backup could not be restored: ${message}`);
      throw error;
    }
  };

  const signOut = async () => {
    await logout();
    setData(null);
    setAuth({ phase: "signed-out" });
  };

  return (
    <AppShell activeView={view} athleteName={data.profile.name} onNavigate={navigate}>
      {saveError ? (
        <div className="save-error" role="alert">
          {saveError}
        </div>
      ) : null}
      {view === "today" ? (
        <TodayPage
          data={data}
          onOpenProgress={() => navigate("progress")}
          onOpenImport={() => openTrainTab("import")}
          onStartRecommendedWorkout={startWorkoutAndGoToTrain}
          onOpenTrainWorkout={() => navigate("train")}
          onOpenTrainRoutines={() => openTrainTab("routines")}
        />
      ) : null}
      {view === "train" ? (
        <TrainPage
          data={data}
          importUndoAvailable={importUndoAvailable}
          onDataChange={persistData}
          onImportCommit={persistImport}
          onUndoImport={undoLastImport}
          workoutDraft={workoutDraft}
          workoutDraftProblem={workoutDraftProblem}
          onStartWorkout={startWorkout}
          onWorkoutDraftChange={persistWorkoutDraft}
          onFinishWorkout={finishWorkout}
          onDiscardWorkout={discardWorkout}
          initialTab={trainInitialTab}
        />
      ) : null}
      {view === "progress" ? (
        <ProgressPage data={data} onOpenTrain={() => navigate("train")} />
      ) : null}
      {view === "body" ? (
        <BodyNutritionPage data={data} onOpenImport={() => openTrainTab("import")} />
      ) : null}
      {view === "library" ? <LibraryPage data={data} onDataChange={persistData} /> : null}
      {view === "compare" ? <ComparePage /> : null}
      {view === "settings" ? (
        <SettingsPage
          data={data}
          onExport={exportBackup}
          onRestore={restoreBackup}
          onSignOut={signOut}
        />
      ) : null}
    </AppShell>
  );
}
