import Link from "next/link";
import { takeNotice } from "@/lib/selling/form-state";
import { PendingButton } from "@/components/kit/PendingButton";
import { getViewer } from "@/lib/auth/session";
import { signInHref } from "@/lib/next-path";
import { LISTING_PHOTO_ACCEPT, PHOTO_MAX_BYTES, SHRINK_MAX_SIDE, SHRINK_QUALITIES, SHRINK_QUALITY } from "@/lib/photos/rules";
import { isPhotoSearchNotice, PHOTO_SEARCH_FORM, PHOTO_SEARCH_NOTICES, PHOTO_SEARCH_PATH } from "@/lib/search/photo";
import { searchByPhoto } from "@/lib/search/photo-actions";
import { PhotoSearchField } from "./PhotoSearchField";

/** The form's room while who's signed in streams in: one block, shorter than the signed-out line and its link. Wordless. */
export function PhotoSearchSkeleton() {
  return <span className="skeleton photo-search-skeleton" aria-hidden="true" />;
}

/**
 * Snap to search's form for this visitor (AI features spec section 5). Request-time: the page puts it inside
 * <Suspense>. Signed out: a sign-in link that comes back here (spec 5.4). Signed in: one labelled photo field, the
 * notice region (always there, so a notice is announced) and a 44px Search button (spec 5.6). A plain form posting to
 * searchByPhoto, so it works before the page's JavaScript arrives.
 */
export async function PhotoSearch() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="photo-search-signed-out">
        <p>Sign in to search with a photo.</p>
        <p>
          <Link href={signInHref(PHOTO_SEARCH_PATH)} prefetch={false} className="btn btn-primary">
            Sign in
          </Link>
        </p>
      </div>
    );
  }
  // Taken as it's shown, so a notice is said once and isn't back for its 10 minutes (selling amendment 10.6).
  const state = await takeNotice(PHOTO_SEARCH_FORM);
  const notice = isPhotoSearchNotice(state?.notice) ? PHOTO_SEARCH_NOTICES[state.notice] : "";
  return (
    <form action={searchByPhoto} className="photo-search-form">
      <div className="form-field">
        <label htmlFor="photo-search-file" className="form-label">
          Photo
        </label>
        <p id="photo-search-hint" className="form-hint">
          One photo of the item, close up. It isn&apos;t kept.
        </p>
        <PhotoSearchField
          input={{
            id: "photo-search-file",
            name: "photo",
            accept: LISTING_PHOTO_ACCEPT,
            required: true,
            "aria-describedby": "photo-search-hint photo-search-notice",
            className: "form-input sell-file",
          }}
          shrinkTo={{ side: SHRINK_MAX_SIDE, quality: SHRINK_QUALITY, budget: PHOTO_MAX_BYTES, qualities: SHRINK_QUALITIES }}
          busy="Getting your photo ready…"
        />
      </div>
      <p id="photo-search-notice" role="status" className="photo-search-notice">
        {notice}
      </p>
      {/* Says "Searching…" and ignores a second press while the photo is read (stage D review): a second press would
          count a second search and send the photo again. */}
      <PendingButton pendingLabel="Searching…" className="btn btn-primary photo-search-button">
        Search
      </PendingButton>
    </form>
  );
}
