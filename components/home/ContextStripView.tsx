"use client";

import Link from "next/link";
import { FlagIcon, MapPinIcon, ShieldIcon } from "@/components/icons";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import type { ViewedItem } from "@/lib/recently-viewed";
import type { ViewerActivity } from "@/lib/types";
import { Photo } from "@/components/listings/Photo";

// Phones and tablets get the short words; the desktop strip has room for the long ones.
const TRUST = [
  { Icon: ShieldIcon, long: "Verified Incubation Hub sellers", short: "Verified sellers" },
  { Icon: MapPinIcon, long: "Approved campus pickup points", short: "Pickup points" },
  { Icon: FlagIcon, long: "Never pay before you see it", short: "See it, then pay" },
];

/**
 * The strip under the hero (spec 7.4): activity when signed in, otherwise the listings viewed on this device,
 * otherwise the trust strip. Every state has the same minimum height, so swapping after hydration moves nothing.
 */
export function ContextStripView({ activity }: { activity: ViewerActivity | null }) {
  const viewed = useRecentlyViewed();
  if (activity) return <SignedInStrip activity={activity} viewed={viewed} />;
  if (viewed.length > 0) return <ReturningStrip viewed={viewed} />;
  return <TrustStrip />;
}

function TrustStrip() {
  return (
    <div className="context-strip context-outlined">
      <h2 id="context-title" className="sr-only">
        Why you can trust CampusCart
      </h2>
      <ul className="context-row context-trust">
        {TRUST.map(({ Icon, long, short }) => (
          <li key={short} className="context-chip">
            <Icon className="context-icon" />
            <span className="desk:hidden">{short}</span>
            <span className="hidden desk:inline">{long}</span>
          </li>
        ))}
        <li className="context-end">
          <Link href="/trust" className="context-link">
            How trust works
          </Link>
        </li>
      </ul>
    </div>
  );
}

function ReturningStrip({ viewed }: { viewed: readonly ViewedItem[] }) {
  return (
    <div className="context-strip context-outlined">
      <h2 id="context-title" className="context-label">
        Pick up where you left off
      </h2>
      <ViewedThumbs viewed={viewed} />
    </div>
  );
}

function SignedInStrip({ activity, viewed }: { activity: ViewerActivity; viewed: readonly ViewedItem[] }) {
  const lines = [
    activity.newMessages > 0 && `${activity.newMessages} new ${activity.newMessages === 1 ? "message" : "messages"}`,
    activity.salesToConfirm > 0 &&
      `${activity.salesToConfirm} ${activity.salesToConfirm === 1 ? "sale" : "sales"} to confirm`,
    activity.savedItemsBack > 0 &&
      `${activity.savedItemsBack} saved ${activity.savedItemsBack === 1 ? "item is" : "items are"} back`,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="context-strip context-signed-in surface-navy">
      <h2 id="context-title" className="context-welcome">
        Welcome back
      </h2>
      <ul className="context-activity">
        {lines.map((line) => (
          <li key={line}>
            <span className="context-dot" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
      {viewed.length > 0 && <ViewedThumbs viewed={viewed} />}
      {/* No prefetch (CLAUDE.md, decision 53). The inbox is messaging's (messaging spec 3.6). */}
      <Link href="/messages" prefetch={false} className="context-link">
        Open inbox
      </Link>
    </div>
  );
}

function ViewedThumbs({ viewed }: { viewed: readonly ViewedItem[] }) {
  return (
    <ul className="context-row context-thumbs">
      {viewed.map((item) => (
        <li key={item.id}>
          {/* No prefetch: a row of thumbnails would fetch every page as it scrolls past (mobile data). */}
          <Link href={`/listings/${item.id}`} prefetch={false} className="context-thumb">
            <Photo image={{ src: item.image.src, alt: "" }} sizes="44px" className="context-thumb-img" />
            <span className="sr-only">{item.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
