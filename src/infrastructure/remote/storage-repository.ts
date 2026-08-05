import { LiftwiseDataSchema, type LiftwiseData } from "../../domain/models/schema";

export type RemoteLoadResult =
  | { status: "empty" }
  | { status: "loaded"; data: LiftwiseData }
  | { status: "corrupt"; message: string }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function errorMessage(response: Response): Promise<string> {
  const body = (await readJson(response).catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Server error (${response.status}).`;
}

export class RemoteStorageRepository {
  async load(): Promise<RemoteLoadResult> {
    let response: Response;
    try {
      response = await fetch("/api/data", { credentials: "include" });
    } catch {
      return { status: "error", message: "Could not reach the server. Check your connection." };
    }
    if (response.status === 401) return { status: "unauthenticated" };
    if (response.status === 404) return { status: "empty" };
    if (response.status === 409) {
      return { status: "corrupt", message: await errorMessage(response) };
    }
    if (!response.ok) {
      return { status: "error", message: await errorMessage(response) };
    }
    const body = await readJson(response);
    const parsed = LiftwiseDataSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: "corrupt",
        message: parsed.error.issues[0]?.message ?? "Stored data failed validation.",
      };
    }
    return { status: "loaded", data: parsed.data };
  }

  async save(data: LiftwiseData): Promise<void> {
    const response = await fetch("/api/data", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
  }

  async saveWithImportUndo(
    data: LiftwiseData,
    previousData: LiftwiseData,
    batchId: string,
  ): Promise<void> {
    const response = await fetch("/api/data/import-snapshot", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, previousData, batchId }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
  }

  async undoLastImport(): Promise<LiftwiseData> {
    const response = await fetch("/api/import/undo", {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    return LiftwiseDataSchema.parse(await readJson(response));
  }

  async hasImportUndo(): Promise<boolean> {
    const response = await fetch("/api/import/undo-available", { credentials: "include" });
    if (!response.ok) return false;
    const body = (await readJson(response)) as { available: boolean };
    return body.available;
  }

  async export(): Promise<string> {
    const response = await fetch("/api/backup/export", { credentials: "include" });
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.text();
  }
}
