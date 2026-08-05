const INPUT_BY_IMPORT_TYPE = Object.freeze({
  workout: "#importInput",
  meal: "#fitatuImportInput",
  backup: "#backupImportInput",
});

export function bindImportChooser({ root = document, openModal, closeModal } = {}) {
  if (typeof openModal !== "function" || typeof closeModal !== "function") {
    throw new TypeError("Import chooser requires openModal and closeModal callbacks.");
  }

  const handleClick = (event) => {
    const clickedElement = event.target?.closest?.(
      "[data-open-import-choice], [data-select-import]",
    );
    if (!clickedElement) return;

    if (clickedElement.matches("[data-open-import-choice]")) {
      event.preventDefault();
      openModal("importChoiceModal");
      return;
    }

    const inputSelector = INPUT_BY_IMPORT_TYPE[clickedElement.dataset.selectImport];
    const fileInput = inputSelector ? root.querySelector(inputSelector) : null;
    closeModal("importChoiceModal");
    if (!fileInput) return;

    fileInput.value = "";
    fileInput.click();
  };

  root.addEventListener("click", handleClick);
  return () => root.removeEventListener("click", handleClick);
}

export { INPUT_BY_IMPORT_TYPE };
