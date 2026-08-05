import { hash, parseFitatuExport, stableStringify } from "../../domain.js";
import { LiftwiseDataSchema, type LiftwiseData, type NutritionDay } from "../models/schema";

const MAX_CSV_BYTES = 10_000_000;
const MAX_CSV_ROWS = 100_000;
const MAX_IMPORT_HISTORY = 30;

type ParsedFitatuDay = {
  date: string;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  rowCount: number;
  sourceRowCount: number;
  aggregation: string;
};

export type RejectedFitatuRow = {
  rowNumber: number;
  date: string;
  item: string;
  reasons: string[];
};

type LegacyFitatuResult = {
  days: ParsedFitatuDay[];
  delimiter: string;
  headerRowNumber: number;
  acceptedRowCount: number;
  totalRowCount: number;
  rejectedRows: RejectedFitatuRow[];
};

export type PendingFitatuImport = {
  kind: "nutrition";
  fileName: string;
  days: NutritionDay[];
  warnings: string[];
  rejectedRows: RejectedFitatuRow[];
  acceptedRowCount: number;
  totalRowCount: number;
  dateRange: string;
};

export type FitatuImportMode = "merge" | "replace";
export type FitatuImportStatus = "added" | "updated" | "unchanged";

export type FitatuImportChange = {
  status: FitatuImportStatus;
  incoming: NutritionDay;
  existing: NutritionDay | null;
};

export type FitatuImportPlan = {
  changes: FitatuImportChange[];
  counts: Record<FitatuImportStatus, number>;
};

function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nutritionFingerprint(
  day: Pick<NutritionDay, "date" | "caloriesKcal" | "proteinG" | "carbsG" | "fatG" | "fiberG">,
): string {
  return `nutrition:${hash(
    stableStringify({
      date: day.date,
      caloriesKcal: day.caloriesKcal,
      proteinG: day.proteinG,
      carbsG: day.carbsG,
      fatG: day.fatG,
      fiberG: day.fiberG,
    }),
  )}`;
}

function dateRange(days: NutritionDay[]): string {
  if (!days.length) return "No dates";
  const dates = days.map(({ date }) => date).sort();
  const first = dates[0]!;
  const last = dates.at(-1)!;
  return first === last ? first : `${first} – ${last}`;
}

function normalizePendingDay(day: ParsedFitatuDay): NutritionDay {
  const normalized = {
    id: `fitatu-${day.date}`,
    date: day.date,
    caloriesKcal: day.caloriesKcal,
    proteinG: day.proteinG,
    carbsG: day.carbsG,
    fatG: day.fatG,
    fiberG: day.fiberG,
    source: "fitatu-csv",
    sourceIdentity: `fitatu:${day.date}`,
    contentFingerprint: "",
    sourceRowCount: day.sourceRowCount,
    aggregation: day.aggregation,
    importBatchId: null,
    importedAt: `${day.date}T12:00:00.000Z`,
  } satisfies NutritionDay;
  return {
    ...normalized,
    contentFingerprint: nutritionFingerprint(normalized),
  };
}

export function parseFitatuCsv(
  text: string,
  fileName: string,
  now = new Date(),
): PendingFitatuImport {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    throw new Error("The CSV exceeds the 10 MB safety limit.");
  }
  const parsed = parseFitatuExport(text, {
    maxRows: MAX_CSV_ROWS,
    today: localDateKey(now),
  }) as LegacyFitatuResult;
  const days = parsed.days.map(normalizePendingDay);
  const warnings: string[] = [];
  if (parsed.headerRowNumber > 1) {
    const skipped = parsed.headerRowNumber - 1;
    warnings.push(
      `${skipped} metadata row${skipped === 1 ? "" : "s"} before the Fitatu table were skipped.`,
    );
  }
  if (parsed.delimiter === ";") warnings.push("A semicolon-separated Fitatu export was detected.");
  if (parsed.delimiter === "\t") warnings.push("A tab-separated Fitatu export was detected.");
  const summarizedDays = days.filter((day) => day.aggregation !== "items").length;
  if (summarizedDays) {
    warnings.push(
      `${summarizedDays} day${summarizedDays === 1 ? "" : "s"} used total rows so food items were not counted twice.`,
    );
  }
  if (parsed.rejectedRows.length) {
    warnings.push(
      `${parsed.rejectedRows.length} invalid or future row${parsed.rejectedRows.length === 1 ? " was" : "s were"} rejected.`,
    );
  }
  return {
    kind: "nutrition",
    fileName,
    days,
    warnings,
    rejectedRows: parsed.rejectedRows,
    acceptedRowCount: parsed.acceptedRowCount,
    totalRowCount: parsed.totalRowCount,
    dateRange: dateRange(days),
  };
}

export function buildFitatuImportPlan(
  data: LiftwiseData,
  pending: PendingFitatuImport,
  mode: FitatuImportMode,
): FitatuImportPlan {
  const changes = pending.days.map((day): FitatuImportChange => {
    const existing =
      mode === "replace"
        ? null
        : (data.nutritionDays.find(
            (item) => item.sourceIdentity === day.sourceIdentity || item.date === day.date,
          ) ?? null);
    if (!existing) return { status: "added", incoming: day, existing };
    if (existing.contentFingerprint === day.contentFingerprint) {
      return {
        status: "unchanged",
        incoming: { ...day, id: existing.id },
        existing,
      };
    }
    return {
      status: "updated",
      incoming: { ...day, id: existing.id },
      existing,
    };
  });
  const counts: FitatuImportPlan["counts"] = {
    added: 0,
    updated: 0,
    unchanged: 0,
  };
  changes.forEach(({ status }) => {
    counts[status] += 1;
  });
  return { changes, counts };
}

export type CommitFitatuImportInput = {
  data: LiftwiseData;
  pending: PendingFitatuImport;
  mode: FitatuImportMode;
  acceptValidRowsOnly: boolean;
  now?: string;
  batchId?: string;
};

export type FitatuImportCommit = {
  data: LiftwiseData;
  previousData: LiftwiseData;
  batchId: string;
  counts: FitatuImportPlan["counts"];
};

export function commitFitatuImport({
  data,
  pending,
  mode,
  acceptValidRowsOnly,
  now = new Date().toISOString(),
  batchId = `fitatu-import-${Date.now()}`,
}: CommitFitatuImportInput): FitatuImportCommit {
  if (pending.rejectedRows.length && !acceptValidRowsOnly) {
    throw new Error(
      "Confirm that only valid rows should be imported after reviewing rejected rows.",
    );
  }
  const plan = buildFitatuImportPlan(data, pending, mode);
  let nutritionDays = mode === "replace" ? [] : [...data.nutritionDays];
  const affectedDates: string[] = [];

  plan.changes.forEach((change) => {
    if (change.status === "unchanged") return;
    const incoming: NutritionDay = {
      ...change.incoming,
      importBatchId: batchId,
      importedAt: now,
    };
    const existingIndex = nutritionDays.findIndex(
      (day) => day.id === change.existing?.id || day.date === incoming.date,
    );
    if (existingIndex >= 0) nutritionDays[existingIndex] = incoming;
    else nutritionDays.push(incoming);
    affectedDates.push(incoming.date);
  });
  nutritionDays = [...nutritionDays].sort((first, second) => first.date.localeCompare(second.date));

  const next = LiftwiseDataSchema.parse({
    ...data,
    nutritionDays,
    integrations: {
      ...data.integrations,
      fitatu: {
        status: "imported",
        lastImportAt: now,
        lastFileName: pending.fileName,
      },
    },
    importBatches: [
      ...data.importBatches,
      {
        id: batchId,
        importedAt: now,
        fileName: pending.fileName,
        source: "fitatu-csv",
        kind: "nutrition",
        workoutCount: 0,
        dayCount: plan.counts.added + plan.counts.updated,
        scope: "all",
        mode,
        added: plan.counts.added,
        updated: plan.counts.updated,
        unchanged: plan.counts.unchanged,
        conflicted: 0,
        rejected: pending.rejectedRows.length,
        affectedDates,
      },
    ].slice(-MAX_IMPORT_HISTORY),
  });

  return {
    data: next,
    previousData: data,
    batchId,
    counts: plan.counts,
  };
}
