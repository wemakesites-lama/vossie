import { refresh } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

// Shared by the selling Server Actions (selling plan, Tasks 7 and 8). A plain module that the "use server" files import.

/** A form field as text. A missing field, or a file, is "". */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Every text value of a repeated field, in order. */
export function fieldList(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

/** The files a file input posted. An empty input posts one nameless, empty file, which is left out. */
export function fileList(formData: FormData, name: string): File[] {
  return formData.getAll(name).filter((value): value is File => typeof value !== "string" && value.size > 0);
}

/**
 * Ends an action (messaging plan decision 6): the browser drops its kept pages, and the redirect replaces this history
 * entry, so Back never lands on a form that's just been sent.
 */
export function done(path: string): never {
  refresh();
  redirect(path, RedirectType.replace);
}
