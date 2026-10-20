import Link from "next/link";
import type { ShopReview } from "@/lib/data/staff-shops";
import { approveSeller, assignMentor, resumeSeller, verifySeller } from "@/lib/staff/admin-actions";
import { declineSellerPath, pauseSellerPath } from "@/lib/staff/paths";
import { longSastDate } from "@/lib/time";
import { OwnShopLine } from "./OwnShopLine";

type AdminSellerProps = {
  review: ShopReview;
  campusName: string;
  categoryName: string;
  /** The shop's pickup points by name, retired ones included. */
  pointNames: readonly string[];
  /** The accounts with the mentor role (plan decision 15). */
  mentors: readonly { id: string; firstName: string }[];
  /** The signed-in admin owns this shop: one line in place of the controls (stage L spec decision 4). */
  own: boolean;
  /** …and is the only admin, so the line says how to hand it on (spec decision 6). */
  onlyAdmin: boolean;
};

/** Where the shop stands, in a sentence; the Hub's reason is the seller's to see, so it's quoted. */
function standingLine({ standing, appliedAt, declinedAt, pausedBy, staffReason, shop }: ShopReview): string {
  switch (standing) {
    case "waiting":
      return appliedAt ? `Waiting for approval since ${longSastDate(appliedAt)}.` : "Waiting for approval.";
    case "declined":
      return `Declined on ${longSastDate(declinedAt ?? "")}. The seller sees your reason: “${staffReason ?? ""}”`;
    case "open":
      return shop.verified ? "Open, and Verified by the Hub." : "Open.";
    case "paused":
      return pausedBy === "staff"
        ? `Paused by the Hub. The seller sees your reason: “${staffReason ?? ""}”`
        : "Paused by the seller.";
  }
}

/**
 * A shop's review page (spec 2.3): its onboarding answers, where it stands, and what its standing allows. Waiting:
 * Approve, or Decline through its confirm page. Open or paused: Verify (or remove it), Pause through its confirm page
 * (or the Hub's Resume), and its mentor. Every button names the shop (spec 4). The admin's own shop shows why instead of
 * the controls (stage L).
 */
export function AdminSeller({ review, campusName, categoryName, pointNames, mentors, own, onlyAdmin }: AdminSellerProps) {
  const { shop, owner, standing } = review;
  const hasStorefront = standing === "open" || standing === "paused";
  const canPause = owner !== null && (standing === "open" || (standing === "paused" && review.pausedBy !== "staff"));
  const mentorField = `admin-mentor-${shop.slug}`;
  return (
    <>
      <section aria-labelledby="admin-shop-title" className="staff-section">
        <h2 id="admin-shop-title" className="staff-section-title">
          The shop
        </h2>
        <p className="staff-standing">{standingLine(review)}</p>
        <dl className="staff-facts">
          <div>
            <dt>Name</dt>
            <dd>{shop.name}</dd>
          </div>
          <div>
            <dt>Tagline</dt>
            <dd>{shop.tagline || "None"}</dd>
          </div>
          <div>
            <dt>Main category</dt>
            <dd>{categoryName}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{campusName}</dd>
          </div>
          <div>
            <dt>Pickup points</dt>
            <dd>{pointNames.length > 0 ? pointNames.join(", ") : "None: it sells online"}</dd>
          </div>
          <div>
            <dt>About</dt>
            <dd className="staff-prewrap">{shop.about}</dd>
          </div>
          <div>
            <dt>Photo</dt>
            <dd>
              {shop.image ? <a href={shop.image.src}>Open the shop&apos;s photo</a> : "None: it shows its category's picture"}
            </dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{owner ? owner.firstName : "A sample shop no account owns"}</dd>
          </div>
          <div>
            <dt>Listed now</dt>
            <dd>{review.listedCount}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="admin-shop-actions-title" className="staff-section">
        <h2 id="admin-shop-actions-title" className="staff-section-title">
          What you can do
        </h2>
        {own ? (
          <OwnShopLine onlyAdmin={onlyAdmin} />
        ) : (
          <>
            {standing === "waiting" && owner && (
              <div className="staff-row-actions">
                <form action={approveSeller}>
                  <input type="hidden" name="shop" value={shop.slug} />
                  {/* The owner reviewed: if the shop is deleted and a new one takes the link, this form does nothing. */}
                  <input type="hidden" name="owner" value={owner.id} />
                  <button type="submit" className="btn btn-primary">
                    Approve {shop.name}
                  </button>
                </form>
                <Link href={declineSellerPath(shop.slug)} prefetch={false} className="btn btn-danger">
                  Decline {shop.name}
                </Link>
              </div>
            )}
            {standing === "declined" && <p>Nothing to do until the seller sends it again.</p>}
            {hasStorefront && (
              <div className="staff-row-actions">
                <form action={verifySeller}>
                  <input type="hidden" name="shop" value={shop.slug} />
                  <input type="hidden" name="verified" value={shop.verified ? "no" : "yes"} />
                  <button type="submit" className="btn btn-outline text-navy">
                    {shop.verified ? `Remove Verified from ${shop.name}` : `Verify ${shop.name}`}
                  </button>
                </form>
                {canPause && (
                  <Link href={pauseSellerPath(shop.slug)} prefetch={false} className="btn btn-danger">
                    Pause {shop.name}
                  </Link>
                )}
                {standing === "paused" && review.pausedBy === "staff" && (
                  <form action={resumeSeller}>
                    <input type="hidden" name="shop" value={shop.slug} />
                    <button type="submit" className="btn btn-primary">
                      Resume {shop.name}
                    </button>
                  </form>
                )}
              </div>
            )}
            {hasStorefront && !owner && <p>A sample shop no account owns can&apos;t be paused.</p>}
          </>
        )}
        {hasStorefront &&
          (standing === "paused" && review.pausedBy === "staff" ? (
            <p className="staff-muted">Buyers can&apos;t see {shop.name} while the Hub&apos;s pause lasts.</p>
          ) : (
            <p>
              <Link href={`/sellers/${shop.slug}`} prefetch={false}>
                See {shop.name}&apos;s storefront
              </Link>
            </p>
          ))}
      </section>

      {owner && hasStorefront && (
        <section aria-labelledby="admin-mentor-title" className="staff-section">
          <h2 id="admin-mentor-title" className="staff-section-title">
            Mentor
          </h2>
          {own ? (
            // Choosing who writes notes about you is a decision about yourself (stage L spec decision 5).
            <p>{review.mentor ? `${review.mentor.firstName} mentors ${shop.name}.` : `${shop.name} has no mentor.`}</p>
          ) : (
            <form action={assignMentor} className="form-stack staff-inline-form">
              <input type="hidden" name="shop" value={shop.slug} />
              <div className="form-field">
                <label htmlFor={mentorField} className="form-label">
                  Mentor for {shop.name}
                </label>
                <select
                  id={mentorField}
                  name="mentor"
                  defaultValue={review.mentor?.id ?? ""}
                  className="form-input form-select"
                >
                  <option value="">No mentor</option>
                  {mentors.map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.firstName}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-outline text-navy form-submit">
                Save mentor for {shop.name}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
