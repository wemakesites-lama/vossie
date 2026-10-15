import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { describedBy, FieldError } from "@/components/forms/FieldError";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { SellerRow } from "@/lib/data/rows";
import { shopFieldIds } from "@/lib/selling/errors";
import { SELL_PATH } from "@/lib/selling/paths";
import { saveShopProfile } from "@/lib/selling/shop-actions";
import type { Campus, Category, PickupPoint, SellerStatus } from "@/lib/types";
import { AboutField, CampusSpotsFields, NameFields, ShopPhotoField } from "./ShopFields";

type ShopProfileViewProps = {
  shop: SellerRow;
  status: SellerStatus;
  /** What was typed before a save that went wrong, or null to show the shop as it is. */
  typed: Readonly<Record<string, string>> | null;
  errors: readonly FormError[];
  notice: string | null;
  campuses: readonly Pick<Campus, "slug" | "name">[];
  categories: readonly Pick<Category, "slug" | "name">[];
  pickupPoints: readonly PickupPoint[];
  /** The site's host, from siteUrl(), for the link's beginning. */
  host: string;
};

const IDS = shopFieldIds("profile");

/**
 * Edit shop (selling spec 2.11): the wizard's fields on one page, then the shop's link, which an approved or paused
 * shop may change once (plan decision 16). Save changes is the form's only submit button, so Enter saves. The summary's
 * id is `profile-summary` (plan amendment 1); every other id starts `profile-` (plan decision 23).
 */
export function ShopProfileView(props: ShopProfileViewProps) {
  const { shop, status, typed, errors, notice, campuses, categories, pickupPoints, host } = props;
  const value = (key: string, fallback: string) => typed?.[key] ?? fallback;
  const chosen = typed ? (typed.points ?? "").split(" ").filter(Boolean) : shop.pickupPointIds;
  return (
    <>
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      <ErrorSummary id="profile-summary" errors={errors} />
      <form action={saveShopProfile} noValidate className="form-stack">
        <NameFields
          ids={IDS}
          errors={errors}
          name={value("name", shop.name)}
          tagline={value("tagline", shop.tagline)}
          categorySlug={value("category", shop.categorySlug)}
          categories={categories}
        />
        <AboutField ids={IDS} errors={errors} about={value("about", shop.about)} />
        <ShopPhotoField
          ids={IDS}
          errors={errors}
          current={shop.image?.src ?? null}
          categorySlug={shop.categorySlug}
          remove="checkbox"
          removeChecked={typed?.removePhoto === "yes"}
        />
        <CampusSpotsFields
          ids={IDS}
          errors={errors}
          campusSlug={value("campus", shop.campusSlug)}
          chosen={chosen}
          campuses={campuses}
          pickupPoints={pickupPoints}
        />
        <LinkField shop={shop} status={status} typed={value("slug", shop.slug)} host={host} errors={errors} />
        <div className="sell-form-buttons">
          <button type="submit" className="btn btn-primary form-submit">
            Save changes
          </button>
          <Link href={SELL_PATH} prefetch={false} className="link-button">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

/** The shop's link (selling spec 2.11): set on approval, then changeable once, with the warning. */
function LinkField({
  shop,
  status,
  typed,
  host,
  errors,
}: {
  shop: SellerRow;
  status: SellerStatus;
  typed: string;
  host: string;
  errors: readonly FormError[];
}) {
  if (status === "pending") {
    return (
      <div className="form-field">
        <p className="form-label">Your shop&apos;s link</p>
        <p className="form-hint">Your shop&apos;s link is set when the Hub approves it.</p>
      </div>
    );
  }
  if (shop.slugChanged) {
    return (
      <div className="form-field">
        <p className="form-label">Your shop&apos;s link</p>
        <p className="sell-slug-now">{`${host}/sellers/${shop.slug}`}</p>
        <p className="form-hint">You&apos;ve already changed your link once.</p>
      </div>
    );
  }
  const error = errorFor(errors, IDS.slug);
  return (
    <div className="form-field">
      <label htmlFor={IDS.slug} className="form-label">
        Your shop&apos;s link
      </label>
      <p id={`${IDS.slug}-hint`} className="form-hint">
        The end of your shop&apos;s address. You can change it once. Links to the old address stop working, so anyone
        who saved one will need the new one.
      </p>
      <FieldError id={`${IDS.slug}-error`} message={error} />
      <div className="sell-slug">
        <span aria-hidden="true">{`${host}/sellers/`}</span>
        <input
          id={IDS.slug}
          name="slug"
          type="text"
          defaultValue={typed}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(`${IDS.slug}-hint`, error && `${IDS.slug}-error`)}
          className="form-input"
        />
      </div>
    </div>
  );
}
