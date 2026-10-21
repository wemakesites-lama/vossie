import { Photo } from "@/components/listings/Photo";
import type { ImageRef } from "@/lib/types";

/**
 * The Hub's story (community spec 5.1): the banner's photo, which is decorative and loads first (plan decision 13),
 * the page's heading and two short paragraphs. The wording is sample text for the Hub to change.
 */
export function HubStory({ image }: { image: ImageRef }) {
  return (
    <div className="hub-story">
      <Photo
        image={{ src: image.src, alt: "" }}
        sizes="(min-width: 64rem) and (min-height: 30rem) 460px, (min-width: 48rem) and (min-height: 30rem) 40vw, 100vw"
        className="hub-story-photo"
        priority
      />
      <div className="hub-story-text">
        <h1 className="hub-story-title">The Incubation Hub</h1>
        <p>
          The Eduvos Incubation Hub backs student businesses on every campus. Its mentors help you price, plan and grow,
          and it runs pitch nights, workshops and office hours through the year.
        </p>
        <p>
          The Hub also runs CampusCart. It checks the sellers who apply and gives the ones it has met and checked the
          Verified badge, so you know who you&apos;re buying from.
        </p>
      </div>
    </div>
  );
}
