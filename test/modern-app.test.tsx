// @vitest-environment jsdom

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, test } from "vitest";
import fixture from "./fixtures/current-data-v9.json";
import { App } from "../src/app/App";
import { STORAGE_KEY } from "../src/infrastructure/local-storage/storage-repository";

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
});

function seed(overrides: Record<string, unknown> = {}) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...fixture, ...overrides }));
}

describe("modern application shell", () => {
  test("presents the decision-first Today hierarchy", () => {
    seed();
    render(<App />);

    screen.getByRole("heading", { name: "What matters today" });
    screen.getAllByText(/Add .* weighted sets for/i);
    screen.getByRole("heading", { name: "Up to three useful priorities" });
    screen.getByText(/Saved on this device/i);
  });

  test("navigates to the read-only plan optimizer by keyboard-operable controls", async () => {
    seed({
      routines: [{
        id: "routine-arms",
        name: "Arms",
        notes: "",
        weekdays: [],
        entries: [
          { exerciseId: "curl", targetSets: 2, targetRir: 3, notes: "" },
          { exerciseId: "concentration-curl", targetSets: 2, targetRir: 3, notes: "" },
        ],
      }],
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Train/i }));
    await user.click(screen.getByRole("tab", { name: "Optimize plan" }));

    screen.getByRole("heading", { name: "Find avoidable complexity" });
    const opportunity = screen.getByRole("heading", { name: /Use one direct elbow-flexion variation instead of two/i })
      .closest("article");
    if (!opportunity) throw new Error("Expected optimization opportunity");
    within(opportunity).getByText("Dumbbell Curl · 4 sets");
    within(opportunity).getByText("Similar planned role");
  });

  test("makes direct-work loss visible for a compound time-saving option", async () => {
    seed({
      routines: [{
        id: "routine-pull",
        name: "Pull",
        notes: "",
        weekdays: [],
        entries: [
          { exerciseId: "one-arm-db-row", targetSets: 3, targetRir: 3, notes: "" },
          { exerciseId: "curl", targetSets: 2, targetRir: 3, notes: "" },
        ],
      }],
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Train/i }));
    await user.click(screen.getByRole("tab", { name: "Optimize plan" }));
    await user.click(screen.getByRole("radio", { name: /Save time/i }));

    screen.getByText("Saves time; changes direct work");
    screen.getByText("Biceps direct work decreases from 2 sets to 0");
    screen.getByText(/Secondary weighted sets are a planning heuristic/i);
  });

  test("applies a mandatory preview as a revision and restores it with exact undo", async () => {
    seed({
      routines: [{
        id: "routine-arms",
        name: "Arms",
        notes: "",
        weekdays: [],
        entries: [
          { exerciseId: "curl", targetSets: 2, targetRir: 2, notes: "Controlled" },
          { exerciseId: "concentration-curl", targetSets: 2, targetRir: 3, notes: "" },
        ],
      }],
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Train/i }));
    await user.click(screen.getByRole("tab", { name: "Optimize plan" }));
    await user.click(screen.getByRole("button", { name: "Preview routine" }));
    await user.click(screen.getByRole("button", { name: "Apply as new revision" }));

    screen.getByText(/Routine revision saved/i);
    const applied = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    assert.deepEqual(applied.routines[0].entries, [{
      exerciseId: "curl",
      targetSets: 4,
      targetRir: 2,
      notes: "Controlled",
    }]);
    assert.equal(applied.routineRevisions.length, 1);

    await user.click(screen.getByRole("button", { name: "Undo revision" }));

    screen.getByText(/exact previous routine was restored/i);
    const undone = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    assert.equal(undone.routines[0].entries.length, 2);
    assert.equal(undone.routineRevisions.length, 2);
  });

  test("routes Fitatu selection through preview, confirm, and exact import undo", async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Train/i }));
    await user.click(screen.getByRole("tab", { name: "Import" }));
    await user.click(screen.getByRole("button", { name: /Meal \/ Fitatu import/i }));
    const input = screen.getByLabelText("Fitatu meal-plan CSV");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected Fitatu file input");
    await user.upload(input, new File([
      readFileSync("test/fixtures/fitatu-meal-plan.csv", "utf8"),
    ], "fitatu-meal-plan.csv", { type: "text/csv" }));

    await screen.findByRole("heading", { name: "Review fitatu-meal-plan.csv" });
    screen.getByText(/Nothing has been written yet/);
    await user.click(screen.getByRole("button", { name: "Confirm import" }));

    await screen.findByText(/2 nutrition days added/i);
    const imported = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    assert.equal(imported.nutritionDays.length, 3);
    assert.equal(imported.importBatches.at(-1).kind, "nutrition");

    await user.click(screen.getByRole("button", { name: "Undo last import" }));
    await screen.findByText(/exact pre-import data was restored/i);
    const restored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    assert.equal(restored.nutritionDays.length, 1);
  });

  test("imports workout CSV with visible preview and traceable default RIR", async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Train/i }));
    await user.click(screen.getByRole("tab", { name: "Import" }));
    await user.click(screen.getByRole("button", { name: /^Workout import/i }));
    const input = screen.getByLabelText("Workout CSV");
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected workout file input");
    await user.upload(input, new File([
      readFileSync("test/fixtures/hevy-workouts.csv", "utf8"),
    ], "hevy-workouts.csv", { type: "text/csv" }));

    await screen.findByRole("heading", { name: "Review hevy-workouts.csv" });
    screen.getByText(/unmapped custom exercises/i);
    await user.click(screen.getByRole("button", { name: "Confirm import" }));

    await screen.findByText(/1 workout added/i);
    const imported = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    const importedWorkout = imported.workouts.find((workout: { source?: string }) => (
      workout.source === "hevy-csv"
    ));
    assert.equal(importedWorkout.entries[0].sets[0].rir, 3);
    assert.equal(importedWorkout.entries[0].sets[0].effortSource, "defaulted");
  });

  test("leaves corrupt source text recoverable", () => {
    window.localStorage.setItem(STORAGE_KEY, "{broken");
    render(<App />);

    screen.getByRole("heading", { name: "Your saved data was left untouched" });
    screen.getByText(/raw recovery copy/i);
    screen.getByRole("link", { name: "Open recovery tools" });
  });
});
