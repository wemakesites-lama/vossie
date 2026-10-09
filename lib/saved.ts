export const SAVED_KEY = "vossie_saved";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Saved listing ids on this device, newest first. Never throws: storage can be blocked. */
export function readSavedIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function getSavedCount(): number {
  return readSavedIds().length;
}

export function isSaved(id: string): boolean {
  return readSavedIds().includes(id);
}

/**
 * Save or unsave a listing. Returns true when it is now saved.
 * Throws when storage is blocked, so the caller can roll back and show "Couldn't update. Try again."
 */
export function toggleSaved(id: string): boolean {
  const ids = readSavedIds();
  const index = ids.indexOf(id);
  if (index === -1) ids.unshift(id);
  else ids.splice(index, 1);
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  emit();
  return index === -1;
}

export function subscribeSaved(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    // A null key means another tab cleared all storage.
    if (event.key === SAVED_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
