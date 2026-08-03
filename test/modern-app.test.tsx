// @vitest-environment jsdom

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

  test("leaves corrupt source text recoverable", () => {
    window.localStorage.setItem(STORAGE_KEY, "{broken");
    render(<App />);

    screen.getByRole("heading", { name: "Your saved data was left untouched" });
    screen.getByText(/raw recovery copy/i);
    screen.getByRole("link", { name: "Open recovery tools" });
  });
});
