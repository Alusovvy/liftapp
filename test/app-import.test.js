/* @vitest-environment jsdom */

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, test, vi } from "vitest";

function applicationBody() {
  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  return html
    .match(/<body>([\s\S]*)<\/body>/i)[1]
    .replace(/<script[\s\S]*?<\/script>/gi, "");
}

function installDialogApi() {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      writable: true,
      value() {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      writable: true,
      value() {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    },
  });
}

describe("application import flow", () => {
  beforeAll(async () => {
    localStorage.clear();
    document.body.innerHTML = applicationBody();
    installDialogApi();
    vi.stubGlobal("requestAnimationFrame", (callback) => callback());
    await import("../src/app.js");
  });

  test("opens the import chooser and routes meals to the Fitatu picker", () => {
    const chooser = document.querySelector("#importChoiceModal");
    const mealInput = document.querySelector("#fitatuImportInput");
    const clickMealInput = vi.spyOn(mealInput, "click").mockImplementation(() => {});

    document.querySelector("#importFileButton").click();
    expect(chooser.open).toBe(true);

    document.querySelector('[data-select-import="meal"]').click();
    expect(chooser.open).toBe(false);
    expect(clickMealInput).toHaveBeenCalledOnce();
  });

  test("opens and closes the chooser without the native dialog API", () => {
    const chooser = document.querySelector("#importChoiceModal");
    const nativeShowModal = chooser.showModal;
    chooser.showModal = undefined;

    document.querySelector("#importFileButton").click();

    expect(chooser.open).toBe(true);
    expect(chooser.classList.contains("modal-fallback-open")).toBe(true);

    chooser.querySelector('[data-close-modal="importChoiceModal"]').click();
    expect(chooser.open).toBe(false);
    expect(chooser.classList.contains("modal-fallback-open")).toBe(false);
    chooser.showModal = nativeShowModal;
  });

  test("defaults new exercise sets to 3 RIR", () => {
    document.querySelector("#newWorkoutButton").click();

    const rirInputs = [...document.querySelectorAll("#workoutModal [data-set-field=rir]")];
    expect(rirInputs.length).toBeGreaterThan(0);
    expect(rirInputs.every((input) => input.value === "3")).toBe(true);

    document.querySelector('[data-close-modal="workoutModal"]').click();
  });

  test("parses a selected Fitatu file and opens its review", async () => {
    const fitatuCsv = [
      "Date,Meal,Products and dishes,quantity (g),calories (kcal),Protein (g),Fats (g),Carbohydrates (g),Fibre (g)",
      "2026-08-01,Breakfast,Oats,100,380.5,13.2,7.1,67.7,10.1",
    ].join("\n");
    const input = document.querySelector("#fitatuImportInput");
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File([fitatuCsv], "fitatu-meals.csv", { type: "text/csv" })],
    });

    input.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.querySelector("#fitatuImportModal").open).toBe(true);
    });
    expect(document.querySelector("#fitatuImportSummary").textContent).toContain("1");
    expect(document.querySelector("#fitatuImportSummary").textContent).toContain("Nutrition days");
  });
});
