"use strict";

  const SCHEMA_VERSION = 9;
  const DEFAULT_RIR = 3;
  const MEASUREMENT_MODES = ["load_reps", "reps", "duration", "distance_duration"];
  const LOAD_MODES = ["total", "per_hand", "added_bodyweight", "assistance", "none"];
  const REP_MODES = ["total", "per_side"];

  function numberOrNull(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const parsed = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[łŁ]/g, "l")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeCsvHeader(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[łŁ]/g, "l")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");
  }

  function delimiterCount(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === "\"") {
        if (quoted && line[index + 1] === "\"") index += 1;
        else quoted = !quoted;
      } else if (!quoted && line[index] === delimiter) {
        count += 1;
      }
    }
    return count;
  }

  function detectDelimiter(source) {
    const lines = String(source || "").split(/\r?\n/).filter((line) => line.trim()).slice(0, 25);
    const candidates = [",", ";", "\t"];
    let best = { delimiter: ",", score: -1 };
    candidates.forEach((delimiter) => {
      const counts = lines.map((line) => delimiterCount(line, delimiter)).filter((count) => count > 0);
      if (!counts.length) return;
      const frequencies = new Map();
      counts.forEach((count) => frequencies.set(count, (frequencies.get(count) || 0) + 1));
      const [mode, frequency] = [...frequencies.entries()].sort((first, second) => (
        second[1] - first[1] || second[0] - first[0]
      ))[0];
      const score = frequency * 1000 + mode * 10 + counts.length;
      if (score > best.score) best = { delimiter, score };
    });
    return best.delimiter;
  }

  function parseDelimitedRows(text, maxRows = 100001) {
    let source = String(text || "").replace(/^\uFEFF/, "");
    let delimiter = null;
    const separatorDirective = source.match(/^sep=([,;\t])\s*(?:\r?\n|$)/i);
    if (separatorDirective) {
      delimiter = separatorDirective[1];
      source = source.slice(separatorDirective[0].length);
    }
    delimiter ||= detectDelimiter(source);
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === "\"") {
        if (quoted && source[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(field);
        field = "";
        if (row.some((value) => String(value).trim() !== "")) {
          rows.push(row);
          if (rows.length > maxRows) throw new Error(`The CSV exceeds the ${maxRows.toLocaleString()}-row safety limit.`);
        }
        row = [];
      } else {
        field += character;
      }
    }
    if (field !== "" || row.length) {
      row.push(field);
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
    }
    if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
    return { delimiter, rows };
  }

  function localizedNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const original = String(value).trim();
    let input = original
      .replace(/[\u00A0\u202F\s']/g, "")
      .replace(/[^\d,.\-+]/g, "");
    if (!input || !/\d/.test(input)) return null;
    const comma = input.lastIndexOf(",");
    const dot = input.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) {
      const decimal = comma > dot ? "," : ".";
      const thousands = decimal === "," ? "." : ",";
      input = input.split(thousands).join("").replace(decimal, ".");
    } else {
      const separator = comma >= 0 ? "," : dot >= 0 ? "." : "";
      if (separator) {
        const parts = input.split(separator);
        if (parts.length > 2) {
          const last = parts.pop();
          input = `${parts.join("")}.${last}`;
        } else {
          input = parts.join(".");
        }
      }
    }
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function fitatuDateKey(value) {
    const input = String(value || "").trim();
    if (!input) return null;
    let match = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D.*)?$/);
    if (match) {
      const [, year, month, day] = match;
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const parsed = new Date(`${key}T12:00:00`);
      return !Number.isNaN(parsed.getTime())
        && parsed.getFullYear() === Number(year)
        && parsed.getMonth() + 1 === Number(month)
        && parsed.getDate() === Number(day) ? key : null;
    }
    match = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\D.*)?$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const parsed = new Date(`${key}T12:00:00`);
    return !Number.isNaN(parsed.getTime())
      && parsed.getFullYear() === Number(year)
      && parsed.getMonth() + 1 === Number(month)
      && parsed.getDate() === Number(day) ? key : null;
  }

  const FITATU_HEADER_ALIASES = {
    date: ["date", "data", "day", "dzien", "data_dnia", "calendar_date"],
    caloriesKcal: ["calories_kcal", "kalorie_kcal", "energy_kcal", "energia_kcal", "kcal", "calories", "kalorie", "energia", "wartosc_energetyczna"],
    proteinG: ["protein_g", "proteins_g", "bialko_g", "protein", "proteins", "bialko"],
    carbsG: ["carbohydrates_g", "carbohydrate_g", "carbs_g", "weglowodany_g", "carbohydrates", "carbohydrate", "carbs", "weglowodany"],
    fatG: ["fat_g", "fats_g", "tluszcz_g", "tluszcze_g", "fat", "fats", "tluszcz", "tluszcze"],
    fiberG: ["fiber_g", "fibre_g", "blonnik_g", "fiber", "fibre", "blonnik"],
    meal: ["meal_name", "meal", "posilek", "kategoria", "category"],
    product: ["products_and_dishes", "food_name", "product_name", "food", "product", "products", "dishes", "produkt", "potrawa", "nazwa"],
  };

  function fitatuHeaderIndex(headers, field) {
    const aliases = FITATU_HEADER_ALIASES[field];
    const blocked = /(?:^|_)(?:goal|target|limit|cel|norma|recommended|zalecane|procent|percent)(?:_|$)/;
    for (const alias of aliases) {
      const exact = headers.findIndex((header) => header === alias && !blocked.test(header));
      if (exact >= 0) return exact;
    }
    return headers.findIndex((header) => (
      !blocked.test(header)
      && aliases.some((alias) => header.startsWith(`${alias}_`) || header.endsWith(`_${alias}`))
    ));
  }

  function fitatuHeaderMap(row) {
    const headers = row.map(normalizeCsvHeader);
    const result = Object.fromEntries(Object.keys(FITATU_HEADER_ALIASES).map((field) => [
      field,
      fitatuHeaderIndex(headers, field),
    ]));
    return { headers, ...result };
  }

  function validNutritionValue(value, maximum) {
    return value !== null && value >= 0 && value <= maximum;
  }

  function sumNutritionRows(rows) {
    const fields = ["caloriesKcal", "proteinG", "carbsG", "fatG", "fiberG"];
    return Object.fromEntries(fields.map((field) => {
      const values = rows.map((row) => row[field]).filter((value) => value !== null);
      if (!values.length) return [field, null];
      const total = values.reduce((sum, value) => sum + value, 0);
      return [field, Math.round(total * 100) / 100];
    }));
  }

  function mostCompleteNutritionRow(rows) {
    return [...rows].sort((first, second) => {
      const completeness = (row) => ["caloriesKcal", "proteinG", "carbsG", "fatG", "fiberG"]
        .filter((field) => row[field] !== null).length;
      return completeness(second) - completeness(first) || second.rowNumber - first.rowNumber;
    })[0];
  }

  function parseFitatuExport(text, options = {}) {
    const maxRows = Number.isInteger(options.maxRows) ? options.maxRows : 100001;
    const today = fitatuDateKey(options.today) || fitatuDateKey(new Date().toISOString().slice(0, 10));
    const { delimiter, rows } = parseDelimitedRows(text, maxRows + 25);
    if (rows.length < 2) throw new Error("The CSV does not contain nutrition rows.");
    let headerIndex = -1;
    let map = null;
    for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
      const candidate = fitatuHeaderMap(rows[index]);
      const macroCount = [candidate.proteinG, candidate.carbsG, candidate.fatG].filter((fieldIndex) => fieldIndex >= 0).length;
      if (candidate.date >= 0 && candidate.caloriesKcal >= 0 && macroCount >= 2) {
        headerIndex = index;
        map = candidate;
        break;
      }
    }
    if (headerIndex < 0) {
      throw new Error("This does not look like a Fitatu nutrition CSV. Expected a date, calories, and at least two macronutrient columns.");
    }

    const groups = new Map();
    const rejectedRows = [];
    let lastDate = null;
    let acceptedRowCount = 0;
    const numericFields = {
      caloriesKcal: { index: map.caloriesKcal, label: "calories", maximum: 20000 },
      proteinG: { index: map.proteinG, label: "protein", maximum: 3000 },
      carbsG: { index: map.carbsG, label: "carbohydrates", maximum: 3000 },
      fatG: { index: map.fatG, label: "fat", maximum: 3000 },
      fiberG: { index: map.fiberG, label: "fiber", maximum: 1000 },
    };

    rows.slice(headerIndex + 1).forEach((row, offset) => {
      const rowNumber = headerIndex + offset + 2;
      const values = [...row];
      while (values.length < map.headers.length) values.push("");
      const rawDate = String(values[map.date] || "").trim();
      if (normalizeCsvHeader(rawDate) === map.headers[map.date]) return;
      let date = rawDate ? fitatuDateKey(rawDate) : lastDate;
      const metrics = {};
      const reasons = [];
      Object.entries(numericFields).forEach(([field, definition]) => {
        if (definition.index < 0) {
          metrics[field] = null;
          return;
        }
        const raw = String(values[definition.index] || "").trim();
        const parsed = localizedNumber(raw);
        metrics[field] = parsed;
        if (raw && parsed === null) reasons.push(`${definition.label} is not a number`);
        else if (parsed !== null && !validNutritionValue(parsed, definition.maximum)) {
          reasons.push(`${definition.label} is outside the supported range`);
        }
      });
      const hasNutrition = Object.values(metrics).some((value) => value !== null);
      if (!hasNutrition) {
        if (rawDate && date) lastDate = date;
        return;
      }
      if (!rawDate && !lastDate && hasNutrition) reasons.push("date is missing");
      if (rawDate && !date) reasons.push("date is invalid");
      if (date && today && date > today) reasons.push("future planned days are not imported");
      if (values.length > map.headers.length) reasons.push("column count does not match the header");
      if (reasons.length) {
        rejectedRows.push({
          rowNumber,
          date: rawDate || lastDate || "—",
          item: String(values[map.product] || values[map.meal] || "—").trim() || "—",
          reasons: [...new Set(reasons)],
        });
        return;
      }
      lastDate = date;
      if (!groups.has(date)) groups.set(date, { rows: [], dailyTotals: [], genericTotals: [] });
      const textCells = [map.meal, map.product]
        .filter((index) => index >= 0)
        .map((index) => normalizeText(values[index]))
        .filter(Boolean);
      const dailyTotal = textCells.some((cell) => (
        ["podsumowanie dnia", "suma dnia", "razem dzien", "daily total", "day total", "daily summary"].includes(cell)
      ));
      const genericTotal = textCells.some((cell) => (
        ["razem", "suma", "podsumowanie", "total", "summary"].includes(cell)
      ));
      const parsedRow = { ...metrics, rowNumber };
      const group = groups.get(date);
      group.rows.push(parsedRow);
      if (dailyTotal) group.dailyTotals.push(parsedRow);
      else if (genericTotal) group.genericTotals.push(parsedRow);
      acceptedRowCount += 1;
    });

    const days = [...groups.entries()].map(([date, group]) => {
      let selectedRows = group.rows;
      let aggregation = "items";
      if (group.dailyTotals.length) {
        selectedRows = [mostCompleteNutritionRow(group.dailyTotals)];
        aggregation = "daily-total";
      } else if (group.genericTotals.length === 1) {
        selectedRows = group.genericTotals;
        aggregation = "total";
      } else if (group.genericTotals.length > 1) {
        selectedRows = group.genericTotals;
        aggregation = "meal-totals";
      }
      return {
        date,
        ...sumNutritionRows(selectedRows),
        rowCount: selectedRows.length,
        sourceRowCount: group.rows.length,
        aggregation,
      };
    }).filter((day) => day.caloriesKcal !== null || day.proteinG !== null)
      .sort((first, second) => first.date.localeCompare(second.date));

    if (!days.length) throw new Error("No valid Fitatu nutrition days were found in the CSV.");
    return {
      days,
      delimiter,
      headerRowNumber: headerIndex + 1,
      acceptedRowCount,
      totalRowCount: Math.max(0, rows.length - headerIndex - 1),
      rejectedRows,
    };
  }

  function hash(value) {
    const input = String(value);
    let result = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      result ^= input.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
    }
    return value;
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function clampEffort(value) {
    const parsed = numberOrNull(value);
    return parsed === null ? null : Math.max(0, Math.min(10, parsed));
  }

  function resolveEffort(set = {}, context = {}) {
    const rawRpe = clampEffort(set.rawRpe ?? set.rpe);
    let explicitImportedRir = clampEffort(set.explicitImportedRir);
    let manualRir = clampEffort(set.manualRir);
    let manualRirCleared = set.manualRirCleared === true;
    const legacyRir = clampEffort(set.rir);
    const legacyManual = set.rirManual === true;
    const source = context.source || set.source || "";

    if (manualRir === null && !manualRirCleared && legacyManual) manualRir = legacyRir;
    if (manualRir === null && !manualRirCleared && !legacyManual && legacyRir !== null) {
      const derived = rawRpe === null ? null : Math.max(0, Math.min(10, 10 - rawRpe));
      const looksDerived = derived !== null && Math.abs(legacyRir - derived) < 0.00001;
      if (!looksDerived) {
        if (source === "hevy-csv" || source === "import") explicitImportedRir = legacyRir;
        else manualRir = legacyRir;
      }
    }

    let effectiveRir = null;
    let effortSource = "missing";
    if (manualRirCleared) {
      effortSource = "manual-cleared";
    } else if (manualRir !== null) {
      effectiveRir = manualRir;
      effortSource = "manual";
    } else if (explicitImportedRir !== null) {
      effectiveRir = explicitImportedRir;
      effortSource = "imported-rir";
    } else if (rawRpe !== null) {
      effectiveRir = Math.max(0, Math.min(10, 10 - rawRpe));
      effortSource = "derived-from-rpe";
    }

    return {
      rawRpe,
      explicitImportedRir,
      manualRir,
      manualRirCleared,
      effectiveRir,
      effortSource,
    };
  }

  function normalizeEffortSet(set = {}, context = {}) {
    const effort = resolveEffort(set, context);
    return {
      ...set,
      rawRpe: effort.rawRpe,
      explicitImportedRir: effort.explicitImportedRir,
      manualRir: effort.manualRir,
      manualRirCleared: effort.manualRirCleared,
      effortSource: effort.effortSource,
      rir: effort.effectiveRir,
      rpe: effort.rawRpe,
      rirManual: effort.effortSource === "manual" || effort.effortSource === "manual-cleared",
    };
  }

  function defaultMissingRir(set = {}, fallback = DEFAULT_RIR, context = {}) {
    const normalized = normalizeEffortSet(set, context);
    if (normalized.rir !== null || normalized.manualRirCleared) return normalized;
    const defaultRir = clampEffort(fallback);
    if (defaultRir === null) return normalized;
    return normalizeEffortSet({
      ...normalized,
      manualRir: defaultRir,
      manualRirCleared: false,
      rirManual: true,
    }, context);
  }

  function updateManualRir(set, rawValue, touched = true) {
    if (!touched) return normalizeEffortSet(set);
    const text = String(rawValue ?? "").trim();
    const manualRir = text === "" ? null : numberOrNull(text);
    return normalizeEffortSet({
      ...set,
      manualRir,
      manualRirCleared: text === "",
      rirManual: true,
    });
  }

  function sourceIdentity(workout = {}) {
    if (workout.sourceIdentity) return String(workout.sourceIdentity);
    if (workout.providerWorkoutId) return `${workout.source || "provider"}:${workout.providerWorkoutId}`;
    if (workout.sourceKey) return String(workout.sourceKey);
    const start = workout.startTime || `${workout.date || ""}T12:00:00`;
    return `${workout.source || "manual"}:${hash(`${start}|${normalizeText(workout.name)}`)}`;
  }

  function contentProjection(workout = {}) {
    return {
      name: String(workout.name || ""),
      date: workout.date || null,
      startTime: workout.startTime || null,
      endTime: workout.endTime || null,
      duration: numberOrNull(workout.duration),
      notes: String(workout.notes || ""),
      entries: (workout.entries || []).map((entry) => ({
        exerciseId: entry.exerciseId || null,
        sourceExerciseName: entry.sourceExerciseName || null,
        exerciseNotes: entry.exerciseNotes || "",
        supersetId: entry.supersetId || null,
        sets: (entry.sets || []).map((set) => ({
          sourceSetId: set.sourceSetId || null,
          index: numberOrNull(set.index),
          type: set.type || "normal",
          weightKg: numberOrNull(set.weightKg),
          reps: numberOrNull(set.reps),
          rawRpe: numberOrNull(set.rawRpe ?? set.rpe),
          explicitImportedRir: numberOrNull(set.explicitImportedRir),
          distanceMeters: numberOrNull(set.distanceMeters),
          durationSeconds: numberOrNull(set.durationSeconds),
          measurementMode: set.measurementMode || null,
        })),
      })),
    };
  }

  function contentFingerprint(workout) {
    return `fp:${hash(stableStringify(contentProjection(workout)))}`;
  }

  function fallbackSetIdentity(entry, set, index) {
    return `${entry.exerciseId || normalizeText(entry.sourceExerciseName)}:${numberOrNull(set.index) ?? index}`;
  }

  function manualEffortOverlay(workout = {}) {
    const overlay = new Map();
    (workout.entries || []).forEach((entry) => (entry.sets || []).forEach((set, index) => {
      const effort = resolveEffort(set, { source: workout.source });
      if (effort.effortSource !== "manual" && effort.effortSource !== "manual-cleared") return;
      const key = set.sourceSetId || fallbackSetIdentity(entry, set, index);
      overlay.set(key, {
        manualRir: effort.manualRir,
        manualRirCleared: effort.manualRirCleared,
      });
    }));
    return overlay;
  }

  function overlayManualEffort(existing, incoming) {
    const overlay = manualEffortOverlay(existing);
    return {
      ...incoming,
      entries: (incoming.entries || []).map((entry) => ({
        ...entry,
        sets: (entry.sets || []).map((set, index) => {
          const key = set.sourceSetId || fallbackSetIdentity(entry, set, index);
          const manual = overlay.get(key);
          return normalizeEffortSet(manual ? { ...set, ...manual, rirManual: true } : set, { source: incoming.source });
        }),
      })),
    };
  }

  function unmatchedManualEffort(existing, incoming) {
    const overlay = manualEffortOverlay(existing);
    if (!overlay.size) return [];
    const incomingKeys = new Set();
    (incoming.entries || []).forEach((entry) => (entry.sets || []).forEach((set, index) => {
      incomingKeys.add(set.sourceSetId || fallbackSetIdentity(entry, set, index));
    }));
    return [...overlay.keys()].filter((key) => !incomingKeys.has(key));
  }

  function compareSourceWorkout(existing, incoming) {
    if (!existing) return { status: "added", existing: null, incoming };
    const before = existing.contentFingerprint || contentFingerprint(existing);
    const after = contentFingerprint(incoming);
    if (before === after) return { status: "unchanged", existing, incoming: { ...incoming, contentFingerprint: after } };
    const unmatchedManual = unmatchedManualEffort(existing, incoming);
    if (unmatchedManual.length) {
      return {
        status: "conflicted",
        existing,
        incoming: { ...incoming, id: existing.id, contentFingerprint: after },
        reason: `${unmatchedManual.length} manually edited RIR set${unmatchedManual.length === 1 ? "" : "s"} no longer match the corrected source workout.`,
        unmatchedManual,
      };
    }
    const updated = overlayManualEffort(existing, { ...incoming, id: existing.id, contentFingerprint: after });
    return { status: "updated", existing, incoming: updated };
  }

  function setMeasurementMode(set = {}, fallback = "load_reps") {
    const candidate = set.measurementMode || fallback;
    return MEASUREMENT_MODES.includes(candidate) ? candidate : "load_reps";
  }

  function isQualifiedSet(set = {}, fallbackMode = "load_reps") {
    if (String(set.type || "normal").toLowerCase() === "warmup") return false;
    const mode = setMeasurementMode(set, fallbackMode);
    if (mode === "duration") return numberOrNull(set.durationSeconds) > 0;
    if (mode === "distance_duration") return numberOrNull(set.distanceMeters) > 0;
    return numberOrNull(set.reps) >= 1;
  }

  function normalizedSetVolume(set = {}, loadMode = "total", repMode = "total") {
    const weight = Math.max(0, numberOrNull(set.weightKg) || 0);
    const reps = Math.max(0, numberOrNull(set.reps) || 0);
    const loadFactor = loadMode === "per_hand" && repMode !== "per_side"
      ? 2
      : loadMode === "assistance" || loadMode === "none" ? 0 : 1;
    const repFactor = repMode === "per_side" ? 2 : 1;
    return weight * reps * loadFactor * repFactor;
  }

  function groupWorkoutsByDay(workouts = []) {
    const groups = new Map();
    workouts.forEach((workout) => {
      if (!groups.has(workout.date)) groups.set(workout.date, []);
      groups.get(workout.date).push(workout);
    });
    return [...groups.entries()]
      .map(([date, sessions]) => {
        const entries = new Map();
        sessions.forEach((session) => (session.entries || []).forEach((entry) => {
          if (!entries.has(entry.exerciseId)) entries.set(entry.exerciseId, { ...entry, sets: [], sourceSessionIds: [] });
          const aggregate = entries.get(entry.exerciseId);
          aggregate.sets.push(...(entry.sets || []));
          if (!aggregate.sourceSessionIds.includes(session.id)) aggregate.sourceSessionIds.push(session.id);
        }));
        return {
          date,
          sessions: [...sessions].sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || ""))),
          entries: [...entries.values()],
        };
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  export {
    SCHEMA_VERSION,
    DEFAULT_RIR,
    MEASUREMENT_MODES,
    LOAD_MODES,
    REP_MODES,
    numberOrNull,
    normalizeText,
    normalizeCsvHeader,
    parseDelimitedRows,
    localizedNumber,
    fitatuDateKey,
    parseFitatuExport,
    hash,
    stableStringify,
    resolveEffort,
    normalizeEffortSet,
    defaultMissingRir,
    updateManualRir,
    sourceIdentity,
    contentProjection,
    contentFingerprint,
    overlayManualEffort,
    unmatchedManualEffort,
    compareSourceWorkout,
    setMeasurementMode,
    isQualifiedSet,
    normalizedSetVolume,
    groupWorkoutsByDay,
  };
