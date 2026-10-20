export type WeighingDraft = {
  lotId: string;
  kind: string;
  date: string;
  headCount: string;
  avgWeight: string;
  weights: Record<string, string>;
  inputs: Record<string, string>;
  cursor: string;
  requestId: string;
};

export const weighingDraftKey = (userId: string, farmId: string) =>
  `liben:weighing-draft:v1:${encodeURIComponent(userId)}:${encodeURIComponent(farmId)}`;

const stringMap = (value: unknown): value is Record<string, string> =>
  !!value && typeof value === "object" && !Array.isArray(value) &&
  Object.values(value).every(item => typeof item === "string");

export function readWeighingDraft(storage: Pick<Storage, "getItem">, key: string): WeighingDraft | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== "object" ||
      !["lotId", "kind", "date", "headCount", "avgWeight", "cursor", "requestId"].every(field => typeof draft[field] === "string") ||
      !["amostral", "individual", "lote_completo"].includes(draft.kind) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
      !/^[0-9a-f-]{36}$/i.test(draft.requestId) ||
      !stringMap(draft.weights) || !stringMap(draft.inputs)) return null;
    return draft as WeighingDraft;
  } catch { return null; }
}

export function writeWeighingDraft(storage: Pick<Storage, "setItem">, key: string, draft: WeighingDraft): boolean {
  try { storage.setItem(key, JSON.stringify(draft)); return true; }
  catch { return false; }
}
