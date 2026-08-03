import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fixture from "../test/fixtures/current-data-v9.json" with { type: "json" };
import path from "node:path";

const storageKey = "liftwise-data-v1";
const workoutDraftKey = "liftwise-active-workout-v1";

function dataWithCurlOpportunity() {
  return {
    ...fixture,
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
  };
}

async function openModernApp(page: Page, data: unknown = fixture) {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, value: data });
  await page.goto("/modern.html");
}

test("presents a decision-first Today view and a working optimization journey", async ({ page }) => {
  await openModernApp(page, dataWithCurlOpportunity());

  await expect(page.getByRole("heading", { name: "What matters today" })).toBeVisible();
  await expect(page.getByText("Saved on this device")).toHaveCount(1);

  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("tab", { name: "Optimize plan" }).click();

  await expect(page.getByRole("heading", {
    name: "Use one direct elbow-flexion variation instead of two",
  })).toBeVisible();
  await expect(page.getByText("Dumbbell Curl · 4 sets")).toBeVisible();

  await page.getByRole("button", { name: "Preview routine" }).click();
  await expect(page.getByRole("heading", {
    name: "Use one direct elbow-flexion variation instead of two",
  }).last()).toBeVisible();
  await expect(page.getByText(/Applying creates an immutable routine revision/)).toBeVisible();

  await page.getByRole("button", { name: "Apply as new revision" }).click();
  await expect(page.getByText(/Routine revision saved/)).toBeVisible();
  await page.getByRole("button", { name: "Undo revision" }).click();
  await expect(page.getByText(/exact previous routine was restored/)).toBeVisible();
});

test("has no serious or critical automated accessibility findings", async ({ page }) => {
  await openModernApp(page);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );

  expect(blocking).toEqual([]);
});

test("imports the supplied Fitatu format through preview, confirm, and undo", async ({ page }) => {
  await openModernApp(page);

  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("tab", { name: "Import" }).click();
  await page.getByRole("button", { name: /^Meal \/ Fitatu import/i }).click();
  await page.getByLabel("Fitatu meal-plan CSV").setInputFiles(
    path.resolve("test/fixtures/fitatu-meal-plan.csv"),
  );

  await expect(page.getByRole("heading", {
    name: "Review fitatu-meal-plan.csv",
  })).toBeVisible();
  await expect(page.getByText(/Nothing has been written yet/)).toBeVisible();
  const previewAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(previewAccessibility.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )).toEqual([]);
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText(/2 nutrition days added/)).toBeVisible();

  await page.getByRole("button", { name: "Undo last import" }).click();
  await expect(page.getByText(/exact pre-import data was restored/)).toBeVisible();

  await page.getByLabel("Fitatu meal-plan CSV").setInputFiles({
    name: "wrong.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("wrong,columns\none,two"),
  });
  await expect(page.getByRole("alert")).toContainText("Import stopped safely");
  await expect(page.getByRole("alert")).toContainText("existing data was not changed");
});

test("imports workout CSV with traceable default effort and source history", async ({ page }) => {
  await openModernApp(page);

  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("tab", { name: "Import" }).click();
  await page.getByRole("button", { name: /^Workout import/i }).click();
  await page.getByLabel("Workout CSV").setInputFiles(
    path.resolve("test/fixtures/hevy-workouts.csv"),
  );

  await expect(page.getByRole("heading", {
    name: "Review hevy-workouts.csv",
  })).toBeVisible();
  await expect(page.getByText(/unmapped custom exercises/i)).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText(/1 workout added/)).toBeVisible();

  const importedSet = await page.evaluate((key) => {
    const data = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    const workout = data.workouts.find((item: { source?: string }) => item.source === "hevy-csv");
    return workout.entries[0].sets[0];
  }, storageKey);
  expect(importedSet).toMatchObject({
    rir: 3,
    effortSource: "defaulted",
    defaultedRir: true,
  });

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Imported").first()).toBeVisible();
});

test("autosaves and completes a focused workout without mobile overflow", async ({ page }) => {
  await openModernApp(page);

  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("button", { name: "Start Upper" }).click();

  await expect(page.getByText(/Active workout · autosaved locally/i)).toBeVisible();
  await expect(page.getByLabel("Dumbbell Bench Press set 1 weight in kg")).toHaveValue("24");
  await expect(page.getByLabel("Dumbbell Bench Press set 1 reps")).toHaveValue("10");
  await page.getByLabel("Dumbbell Bench Press set 1 RIR").fill("");
  await page.getByLabel("Mark Dumbbell Bench Press set 1 complete").check();

  const draftExists = await page.evaluate((key) => (
    window.localStorage.getItem(key) !== null
  ), workoutDraftKey);
  expect(draftExists).toBe(true);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )).toEqual([]);

  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByText(/Workout saved/i)).toBeVisible();
  const completed = await page.evaluate(({ dataKey, draftKey }) => {
    const data = JSON.parse(window.localStorage.getItem(dataKey) ?? "{}");
    return {
      workout: data.workouts.at(-1),
      draft: window.localStorage.getItem(draftKey),
    };
  }, { dataKey: storageKey, draftKey: workoutDraftKey });
  expect(completed.workout.entries[0].sets).toHaveLength(1);
  expect(completed.workout.entries[0].sets[0].rir).toBe(3);
  expect(completed.draft).toBeNull();
});

test("keeps progress decisions auditable and usable on a narrow screen", async ({ page }) => {
  await openModernApp(page);

  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("heading", {
    name: "Highest-value reviews for this week",
  })).toBeVisible();
  await expect(page.getByText(/Planning model, not a readiness score/i)).toBeVisible();

  await page.getByRole("tab", { name: "Exercises" }).click();
  await expect(page.getByRole("heading", { name: "Exercise decisions" })).toBeVisible();
  await expect(page.getByText("Emerging")).toBeVisible();
  await page.getByText("Why and comparable history").first().click();
  await expect(page.getByRole("columnheader", { name: "Top qualified set" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  )).toEqual([]);

  await page.getByRole("tab", { name: "Recovery" }).click();
  await expect(page.getByText(/do not prove that a recovery input caused/i)).toBeVisible();
});

test("keeps the primary experience usable at 320 pixels", async ({ page }) => {
  await openModernApp(page);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  await expect(page.getByRole("heading", { name: "What matters today" })).toBeVisible();
  await page.getByRole("button", { name: "Train", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan, perform, review" })).toBeVisible();
});
