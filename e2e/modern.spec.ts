import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fixture from "../test/fixtures/current-data-v9.json" with { type: "json" };

const storageKey = "liftwise-data-v1";

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
