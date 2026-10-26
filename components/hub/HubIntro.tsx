import Link from "next/link";
import { NavPending } from "@/components/ui/NavPending";
import { hubFeedHref } from "@/lib/hub";
import { TAB } from "@/lib/motion";

/**
 * Launchpad's intro (Launchpad spec 4.1): what it is for, in one sentence, and the two things a student comes to do.
 * No photo, so the heading is the first thing painted. The wording is sample text for the Hub to change.
 */
export function HubIntro() {
  return (
    <div className="hub-intro">
      <p className="hub-intro-eyebrow">For student businesses</p>
      <h1 className="hub-intro-title">Launchpad</h1>
      <p className="hub-intro-lede">
        Free help to start and grow your business on campus: mentors, office hours, pitch nights and workshops.
      </p>
      <p className="hub-intro-actions">
        {/* No prefetch: the same page with Coming up narrowed to office hours. */}
        <Link href={hubFeedHref("office-hours")} prefetch={false} className="btn btn-primary">
          Book office hours
        </Link>
        <Link href="/sell" className="btn btn-outline text-navy" transitionTypes={TAB}>
          Start selling
          <NavPending />
        </Link>
      </p>
    </div>
  );
}
