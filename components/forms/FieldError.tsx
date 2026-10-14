/** The message under a field (accounts spec 3.1), joined to it by aria-describedby. Nothing when there's no error. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="form-error">
      <span className="sr-only">Error:</span> {message}
    </p>
  );
}

/** A field's aria-describedby: the ids it's given that aren't empty, or nothing at all. */
export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined || undefined;
}
