export type Toast = { id: number; message: string };

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Show a short confirmation, e.g. "Showing Midrand first". A new toast replaces the current one. */
export function showToast(message: string): void {
  current = { id: nextId++, message };
  emit();
}

/** Dismiss the current toast; with an id, only if that toast is still the one showing. */
export function dismissToast(id?: number): void {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

export function getToast(): Toast | null {
  return current;
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
