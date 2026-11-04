import Link from "next/link";
import { CameraIcon } from "@/components/icons";

/**
 * "Search with a photo" under the search overlay's box (AI features spec section 5). A Server Component the root layout
 * renders and hands the overlay as a node, so neither it nor its icon is in the overlay's client code, which every page
 * loads (the listing forms sit at the 150 KB budget). No prefetch: the photo page's client code loads only there
 * (spec 5.5). The overlay closes on any link click.
 */
export function PhotoSearchLink() {
  return (
    <p className="search-photo">
      <Link href="/browse/photo" prefetch={false} className="search-photo-link">
        <CameraIcon className="size-5" />
        Search with a photo
      </Link>
    </p>
  );
}
