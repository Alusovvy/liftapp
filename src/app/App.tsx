import { useEffect, useState } from "react";
import { AppShell, type PrimaryView } from "../components/layout/AppShell";
import { DataProblem } from "../components/feedback/DataProblem";
import { BodyNutritionPage } from "../features/body-nutrition/BodyNutritionPage";
import { LibraryPage } from "../features/library/LibraryPage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TodayPage } from "../features/today/TodayPage";
import { TrainPage } from "../features/train/TrainPage";
import {
  LiftwiseStorageRepository,
  type StorageLoadResult,
} from "../infrastructure/local-storage/storage-repository";

const views: PrimaryView[] = ["today", "train", "progress", "body", "library", "settings"];

function initialView(): PrimaryView {
  const candidate = window.location.hash.replace(/^#/, "") as PrimaryView;
  return views.includes(candidate) ? candidate : "today";
}

export function App() {
  const [view, setView] = useState<PrimaryView>(initialView);
  const [storageResult] = useState<StorageLoadResult>(() => (
    new LiftwiseStorageRepository(window.localStorage).load()
  ));

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

  const data = storageResult.data;
  return (
    <AppShell
      activeView={view}
      athleteName={data.profile.name}
      onNavigate={navigate}
    >
      {view === "today" ? <TodayPage data={data} onOpenProgress={() => navigate("progress")} /> : null}
      {view === "train" ? <TrainPage data={data} /> : null}
      {view === "progress" ? <ProgressPage data={data} /> : null}
      {view === "body" ? <BodyNutritionPage data={data} /> : null}
      {view === "library" ? <LibraryPage data={data} /> : null}
      {view === "settings" ? <SettingsPage data={data} /> : null}
    </AppShell>
  );
}
