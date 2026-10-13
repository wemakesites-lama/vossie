import { Photo } from "@/components/listings/Photo";
import { cx } from "@/lib/cx";
import type { Listing } from "@/lib/types";

const COVER_SIZES =
  "(min-width: 64rem) and (min-height: 30rem) 720px, (min-width: 48rem) and (min-height: 30rem) 80vw, 100vw";
const MORE_SIZES =
  "(min-width: 64rem) and (min-height: 30rem) 360px, (min-width: 48rem) and (min-height: 30rem) 70vw, 88vw";

/**
 * The listing's photos (spec 5.6). Phones: a strip you swipe, with the next photo's edge peeking in. Desktop: the
 * cover large and the rest two to a row (plan decision 9's layout). With data saver on, only the cover loads; the
 * rest wait behind "Show 2 more photos".
 */
export function Gallery({ listing }: { listing: Pick<Listing, "image" | "morePhotos"> }) {
  const photos = [listing.image, ...listing.morePhotos];
  const count = photos.length;
  const many = count > 1;
  const more = count - 1;
  const alt = (index: number) => (many ? `${photos[index].alt}. Photo ${index + 1} of ${count}` : photos[index].alt);

  return (
    <div className="gallery">
      {/* A scrolling region must be reachable from the keyboard (axe: scrollable-region-focusable). */}
      <div
        className={cx("gallery-strip", many && "gallery-strip-many")}
        role={many ? "region" : undefined}
        aria-label={many ? "Photos" : undefined}
        tabIndex={many ? 0 : undefined}
      >
        <ul className="gallery-list">
          {photos.map((photo, index) => (
            <li key={`${photo.src} ${index}`} className={cx("gallery-item", index > 0 && "gallery-more")}>
              <Photo
                image={{ src: photo.src, alt: alt(index) }}
                ratio="1 / 1"
                sizes={index === 0 ? COVER_SIZES : MORE_SIZES}
                priority={index === 0}
                className="gallery-photo"
              />
            </li>
          ))}
        </ul>
      </div>
      {many && (
        <>
          <p className="gallery-count" aria-hidden="true">
            {count} photos
          </p>
          {/* Shown only with data saver on, in place of the strip's extra photos (spec 5.6). */}
          <details className="gallery-saver">
            <summary className="btn btn-outline text-navy">
              Show {more} more {more === 1 ? "photo" : "photos"}
            </summary>
            <ul className="gallery-saver-list">
              {photos.slice(1).map((photo, index) => (
                <li key={`${photo.src} ${index}`}>
                  <Photo image={{ src: photo.src, alt: alt(index + 1) }} ratio="1 / 1" sizes={MORE_SIZES} />
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
