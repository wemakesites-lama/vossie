import type { ShownPhotoTip } from "@/lib/selling/suggest";

/**
 * A photo tip after "Fill in from my photo" (AI round two spec 7), drawn on the server beside the photos: what to fix
 * in one photo and, for a better cover, Make it the cover, which posts the photo field's own move ("<photo>:cover")
 * with the form. No client code, and nothing is stored: the next post drops it.
 */
export function PhotoTipHint({ prefix, tip }: { prefix: string; tip: ShownPhotoTip }) {
  const id = `${prefix}-photo-tip`;
  return (
    <div className="photo-tip">
      <p id={id} className="form-hint">
        <strong>Tip for photo {tip.place}:</strong> {tip.text}
      </p>
      {tip.kind === "better-cover" && (
        <button type="submit" name="photoMove" value={`${tip.src}:cover`} aria-describedby={id} className="sell-action">
          Make it the cover
        </button>
      )}
    </div>
  );
}
