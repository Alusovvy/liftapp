import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fixture from "../test/fixtures/current-data-v9.json" with { type: "json" };
import path from "node:path";

const workoutDraftKey = "liftwise-active-workout-v1";
const TEST_PASSWORD = "correct-horse-battery-staple";

function randomUsername(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getSavedData(page: Page): Promise<Record<string, unknown>> {
  const response = await page.request.get("/api/data");
  return response.json();
}

function dataWithCurlOpportunity() {
  return {
    ...fixture,
    routines: [
      {
        id: "routine-arms",
        name: "Arms",
        notes: "",
        weekdays: [],
        entries: [
          { exerciseId: "curl", targetSets: 2, targetRir: 3, notes: "" },
          { exerciseId: "concentration-curl", targetSets: 2, targetRir: 3, notes: "" },
        ],
      },
    ],
  };
}

function dataWithNoBaselineAndUnscheduledRoutine() {
  return {
    ...fixture,
    workouts: [],
    routines: [
      {
        id: "routine-upper",
        name: "Upper",
        notes: "",
        weekdays: [],
        entries: [{ exerciseId: "db-bench", targetSets: 3, targetRir: 2, notes: "" }],
      },
    ],
  };
}

function dataWithRoutineScheduledToday() {
  return {
    ...fixture,
    workouts: [],
    routines: [
      {
        id: "routine-today",
        name: "Scheduled today",
        notes: "",
        weekdays: [new Date().getDay()],
        entries: [{ exerciseId: "db-bench", targetSets: 3, targetRir: 2, notes: "" }],
      },
    ],
  };
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dataWithMixedMuscleCoverage() {
  return {
    ...fixture,
    workouts: [
      ...fixture.workouts,
      {
        id: "w-today-chest",
        source: "manual",
        date: localDateKey(new Date()),
        name: "Push day",
        duration: 40,
        notes: "",
        entries: [
          {
            exerciseId: "db-bench",
            measurementMode: "load_reps",
            loadMode: "per_hand",
            repMode: "total",
            sets: Array.from({ length: 12 }, (_, index) => ({
              index,
              type: "normal",
              measurementMode: "load_reps",
              weightKg: 30,
              reps: 8,
              rir: 2,
              effortSource: "manual",
            })),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

async function openModernApp(page: Page, data: unknown = fixture) {
  const username = randomUsername();
  await page.request.post("/api/test/create-user", {
    data: { username, password: TEST_PASSWORD },
  });
  await page.request.post("/api/login", { data: { username, password: TEST_PASSWORD } });
  await page.request.put("/api/data", { data });
  await page.goto("/modern.html");
}

test("presents a decision-first Today view and a working optimization journey", async ({
  page,
}) => {
  await openModernApp(page, dataWithCurlOpportunity());

  await expect(page.getByRole("heading", { name: "What matters today" })).toBeVisible();
  await expect(page.getByText("Saved to your account")).toHaveCount(1);

  await page.getByRole("button", { name: "Train", exact: true }).click();
  await page.getByRole("tab", { name: "Optimize plan" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Use one direct elbow-flexion variation instead of two",
    }),
  ).toBeVisible();
  await expect(page.getByText("Dumbbell Curl · 4 sets")).toBeVisible();

  await page.getByRole("button", { name: "Preview routine" }).click();
  await expect(
    page
      .getByRole("heading", {
        name: "Use one direct elbow-flexion variation instead of two",
      })
      .last(),
  ).toBeVisible();
  await expect(page.getByText(/Applying creates an immutable routine revision/)).toBeVisible();

  await page.getByRole("button", { name: "Apply as new revision" }).click();
  await expect(page.getByText(/Routine revision saved/)).toBeVisible();
  await page.getByRole("button", { name: "Undo revision" }).click();
  await expect(page.getByText(/exact previous routine was restored/)).toBeVisible();
});

test("Today's baseline recommendation opens the modern workout picker and routine list, never legacy", async ({
  page,
}) => {
  await openModernApp(page, dataWithNoBaselineAndUnscheduledRoutine());

  await expect(page.getByRole("heading", { name: "Establish a useful baseline" })).toBeVisible();
  const primary = page.getByRole("link", { name: "Log baseline" });
  await expect(primary).toHaveCount(0);
  await page.getByRole("button", { name: "Log baseline" }).click();

  await expect(page.getByRole("tab", { name: "Workout", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Start with a clear plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Upper" })).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Choose a routine" }).click();

  await expect(page.getByRole("tab", { name: "Routines", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Upper", exact: true })).toBeVisible();
});

test("Today's scheduled-session recommendation starts the routine directly; adjusting shows the picker instead", async ({
  page,
}) => {
  await openModernApp(page, dataWithRoutineScheduledToday());

  await expect(page.getByRole("heading", { name: /^Train Scheduled today/ })).toBeVisible();
  await page.getByRole("button", { name: "Start workout" }).click();

  await expect(page.getByRole("tab", { name: "Workout", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Start with a clear plan" })).toHaveCount(0);
  await expect(page.getByLabel("Workout name")).toHaveValue("Scheduled today");

  await page.evaluate((key) => window.localStorage.removeItem(key), workoutDraftKey);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Adjust session" }).click();

  await expect(page.getByRole("tab", { name: "Workout", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Start with a clear plan" })).toBeVisible();
});

test("has no persistent legacy-app link and offers one-press Import shortcuts", async ({
  page,
}) => {
  await openModernApp(page);

  await expect(page.getByRole("link", { name: /open current workout logger/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Import", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: /^Meal \/ Fitatu import/i })).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Body & nutrition", exact: true }).click();
  await page.getByRole("button", { name: "Open Fitatu import" }).click();
  await expect(page.getByRole("tab", { name: "Import", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
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
  await page
    .getByLabel("Fitatu meal-plan CSV")
    .setInputFiles(path.resolve("test/fixtures/fitatu-meal-plan.csv"));

  await expect(
    page.getByRole("heading", {
      name: "Review fitatu-meal-plan.csv",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Nothing has been written yet/)).toBeVisible();
  const previewAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    previewAccessibility.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
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
  await page
    .getByLabel("Workout CSV")
    .setInputFiles(path.resolve("test/fixtures/hevy-workouts.csv"));

  await expect(
    page.getByRole("heading", {
      name: "Review hevy-workouts.csv",
    }),
  ).toBeVisible();
  await expect(page.getByText(/unmapped custom exercises/i)).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText(/1 workout added/)).toBeVisible();

  const saved = await getSavedData(page);
  const workouts = saved.workouts as Array<{
    source?: string;
    entries: Array<{ sets: unknown[] }>;
  }>;
  const workout = workouts.find((item) => item.source === "hevy-csv");
  if (!workout) throw new Error("Expected an imported hevy-csv workout.");
  const importedSet = workout.entries[0]?.sets[0];
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

  const draftExists = await page.evaluate(
    (key) => window.localStorage.getItem(key) !== null,
    workoutDraftKey,
  );
  expect(draftExists).toBe(true);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);

  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByText(/Workout saved/i)).toBeVisible();

  const saved = await getSavedData(page);
  const workouts = saved.workouts as Array<{ entries: Array<{ sets: Array<{ rir: number }> }> }>;
  const completedWorkout = workouts.at(-1);
  if (!completedWorkout) throw new Error("Expected a completed workout.");
  expect(completedWorkout.entries[0]?.sets).toHaveLength(1);
  expect(completedWorkout.entries[0]?.sets[0]?.rir).toBe(3);

  const draftAfterFinish = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    workoutDraftKey,
  );
  expect(draftAfterFinish).toBeNull();
});

test("keeps progress decisions auditable and usable on a narrow screen", async ({ page }) => {
  await openModernApp(page);

  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Highest-value reviews for this week",
    }),
  ).toBeVisible();
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
  expect(
    accessibility.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);

  await page.getByRole("tab", { name: "Recovery" }).click();
  await expect(page.getByText(/do not prove that a recovery input caused/i)).toBeVisible();
});

test("muscle map shows weekly coverage status and updates when navigating weeks", async ({
  page,
}) => {
  await openModernApp(page, dataWithMixedMuscleCoverage());

  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByRole("tab", { name: "Muscles" }).click();

  await expect(page.getByRole("heading", { name: "Muscle coverage" })).toBeVisible();
  await expect(page.getByText("Current week")).toBeVisible();

  const chestRegion = page.getByRole("button", { name: /^Chest: In range/ });
  await expect(chestRegion).toBeVisible();
  await chestRegion.click();
  await expect(page.locator("#muscle-row-Chest")).toHaveClass(/is-selected/);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Back:/ })).toBeVisible();
  await expect(chestRegion).toHaveCount(0);
  await page.getByRole("button", { name: "Front", exact: true }).click();

  await expect(page.getByRole("button", { name: "Next week" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous week" }).click();
  await expect(page.getByText("Current week")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Chest: Below range/ })).toBeVisible();

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByText("Current week")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next week" })).toBeDisabled();
});

test("keeps body context neutral, library choices persistent, and backup restore explicit", async ({
  page,
}) => {
  const phaseData = {
    ...fixture,
    favoriteExercises: [],
    libraryPreferences: {
      ...fixture.libraryPreferences,
      availableOnly: false,
    },
    bodyMetrics: [
      {
        id: "body-1",
        date: "2026-07-15",
        weightKg: 80,
        bodyFatPercent: 20,
        note: "",
        recordedAt: "",
      },
      {
        id: "body-2",
        date: "2026-07-22",
        weightKg: 79.5,
        bodyFatPercent: 19.8,
        note: "",
        recordedAt: "",
      },
      {
        id: "body-3",
        date: "2026-07-29",
        weightKg: 79,
        bodyFatPercent: 19.6,
        note: "",
        recordedAt: "",
      },
    ],
  };
  await openModernApp(page, phaseData);

  await page.getByRole("button", { name: "Body & nutrition" }).click();
  await expect(page.getByRole("heading", { name: "Weight decreased" })).toBeVisible();
  await expect(page.getByText(/Missing days are excluded, never treated as zero/i)).toBeVisible();

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Add Dumbbell Bench Press to favorites" }).click();
  await page.getByRole("button", { name: "Available now" }).click();
  // These preference toggles save in the background with no visible
  // confirmation, so poll the server until the write lands instead of
  // racing a single read against it.
  await expect
    .poll(async () => {
      const saved = await getSavedData(page);
      return {
        favorite: (saved.favoriteExercises as string[]).includes("db-bench"),
        availableOnly: (saved.libraryPreferences as { availableOnly: boolean }).availableOnly,
      };
    })
    .toEqual({ favorite: true, availableOnly: true });

  await page.getByRole("button", { name: /Settings & data/ }).click();
  await expect(page.getByRole("heading", { name: "Data safety" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^liftwise-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const replacement = {
    ...phaseData,
    profile: { ...phaseData.profile, name: "Restored in browser" },
    workouts: [],
  };
  await page.getByLabel("Choose Liftwise backup").setInputFiles({
    name: "replacement.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await expect(
    page.getByRole("heading", {
      name: /Restored in browser · schema v9/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Replace with this backup",
    }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: /replace all current local data/i,
    })
    .check();

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

  await page.getByRole("button", { name: "Replace with this backup" }).click();
  await expect(page.getByText(/Backup restored/i)).toBeVisible();
  const restored = await getSavedData(page);
  expect((restored.profile as { name: string }).name).toBe("Restored in browser");
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

  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "See how the group's week is going" }),
  ).toBeVisible();
  const compareDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(compareDimensions.content).toBeLessThanOrEqual(compareDimensions.viewport);
});

test("Compare shows every account's current week and updates when the metric changes", async ({
  page,
}) => {
  const viewerUsername = randomUsername();
  const friendUsername = randomUsername();

  await page.request.post("/api/test/create-user", {
    data: { username: friendUsername, password: TEST_PASSWORD },
  });
  await page.request.post("/api/login", {
    data: { username: friendUsername, password: TEST_PASSWORD },
  });
  await page.request.put("/api/data", {
    data: {
      ...fixture,
      workouts: [
        {
          id: "friend-w1",
          source: "manual",
          date: localDateKey(new Date()),
          name: "Push",
          duration: 40,
          notes: "",
          entries: [
            {
              exerciseId: "db-bench",
              measurementMode: "load_reps",
              loadMode: "per_hand",
              repMode: "total",
              sets: Array.from({ length: 6 }, (_, index) => ({
                index,
                type: "normal",
                measurementMode: "load_reps",
                weightKg: 20,
                reps: 10,
                rir: 2,
                effortSource: "manual",
              })),
            },
          ],
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  });

  await page.request.post("/api/test/create-user", {
    data: { username: viewerUsername, password: TEST_PASSWORD },
  });
  await page.request.post("/api/login", {
    data: { username: viewerUsername, password: TEST_PASSWORD },
  });
  await page.request.put("/api/data", { data: { ...fixture, workouts: [] } });

  await page.goto("/modern.html");
  await page.getByRole("button", { name: "Compare", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "See how the group's week is going" }),
  ).toBeVisible();
  const viewerRow = page.getByRole("listitem").filter({ hasText: viewerUsername });
  const friendRow = page.getByRole("listitem").filter({ hasText: friendUsername });
  await expect(viewerRow).toBeVisible();
  await expect(friendRow).toBeVisible();
  await expect(viewerRow).toContainText("0 sessions");
  await expect(friendRow).toContainText("1 session");

  await page.getByLabel("Compare").selectOption({ label: "Chest weekly sets" });
  await expect(friendRow).toContainText("6 weighted sets");

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);
});
