/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bindImportChooser, INPUT_BY_IMPORT_TYPE } from "../src/ui/import-chooser.js";

describe("import chooser", () => {
  let openModal;
  let closeModal;
  let unbind;

  beforeEach(() => {
    document.body.innerHTML = `
      <button data-open-import-choice>Import file</button>
      <button data-select-import="workout">Workout</button>
      <button data-select-import="meal">Meal</button>
      <button data-select-import="backup">Backup</button>
      <input id="importInput" type="file">
      <input id="fitatuImportInput" type="file">
      <input id="backupImportInput" type="file">
    `;
    openModal = vi.fn();
    closeModal = vi.fn();
  });

  afterEach(() => {
    unbind?.();
    unbind = null;
    vi.restoreAllMocks();
  });

  test("opens the type chooser from Import file", () => {
    unbind = bindImportChooser({ openModal, closeModal });

    document.querySelector("[data-open-import-choice]").click();

    expect(openModal).toHaveBeenCalledOnce();
    expect(openModal).toHaveBeenCalledWith("importChoiceModal");
    expect(closeModal).not.toHaveBeenCalled();
  });

  test.each([
    ["workout", "#importInput"],
    ["meal", "#fitatuImportInput"],
    ["backup", "#backupImportInput"],
  ])("routes %s imports to the correct file input", (type, selector) => {
    const fileInput = document.querySelector(selector);
    const clickFileInput = vi.spyOn(fileInput, "click").mockImplementation(() => {});
    unbind = bindImportChooser({ openModal, closeModal });

    document.querySelector(`[data-select-import="${type}"]`).click();

    expect(closeModal).toHaveBeenCalledWith("importChoiceModal");
    expect(clickFileInput).toHaveBeenCalledOnce();
  });

  test("can be unbound without leaving a document-level handler", () => {
    const stopListening = bindImportChooser({ openModal, closeModal });
    stopListening();

    document.querySelector("[data-open-import-choice]").click();

    expect(openModal).not.toHaveBeenCalled();
  });

  test("keeps the import type map explicit", () => {
    expect(INPUT_BY_IMPORT_TYPE).toEqual({
      workout: "#importInput",
      meal: "#fitatuImportInput",
      backup: "#backupImportInput",
    });
  });
});
