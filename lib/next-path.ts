/**
 * A `next` link parameter that's safe to link back to (browse and listing spec 5.9): a path on this site. Anything
 * else is refused: another site, a protocol-relative "//", a backslash (some browsers read it as a slash), and
 * spaces or control characters (browsers drop some of them, which can turn "/\t/" into "//").
 */
export function safeNextPath(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const unsafe = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f;
  });
  return unsafe ? null : value;
}
