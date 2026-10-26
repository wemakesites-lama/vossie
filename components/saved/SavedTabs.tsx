import { Reveal } from "@/components/kit/Reveal";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { parseSavedTab, savedTabPath, type SavedTab } from "@/lib/following/rules";
import { SEARCHES_NOTE } from "@/lib/saved-searches/words";
import { FollowedShops } from "./FollowedShops";
import { SavedList } from "./SavedList";
import { SavedSearches } from "./SavedSearches";
import { SavedSkeleton } from "./SavedSkeleton";

type SavedTabsProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Saved's three tabs (community actions spec 2.17, plan decision 17): links, the open one marked aria-current, then the
 * tab's note and its list. It reads `?tab=`, so Saved's page puts it inside <Suspense>. The device note belongs to
 * Listings; Shops are kept with the account,
 * and so are Searches (search alerts spec 2.7).
 *
 * It reads the tab here, then puts the rest inside a <Suspense> keyed by that tab (plan amendment 14): a client-side
 * switch makes a new boundary, so the skeleton shows while the other tab loads, never the old tab's content.
 */
export async function SavedTabs({ searchParams }: SavedTabsProps) {
  const tab = parseSavedTab((await searchParams).tab);
  return (
    <Reveal key={tab} fallback={<SavedSkeleton />}>
      <SavedTabContent tab={tab} />
    </Reveal>
  );
}

function SavedTabContent({ tab }: { tab: SavedTab }) {
  return (
    <>
      <LinkTabs
        label="What's saved"
        look="tabs"
        current={tab}
        tabs={[
          { key: "listings", label: "Listings", href: savedTabPath("listings") },
          { key: "shops", label: "Shops", href: savedTabPath("shops") },
          { key: "searches", label: "Searches", href: savedTabPath("searches") },
        ]}
      />
      {tab === "listings" && (
        <>
          <p className="saved-note">
            Saved on this device. Once CampusCart is live, your saves will follow your account to any device.
          </p>
          <SavedList />
        </>
      )}
      {tab === "shops" && (
        <>
          <p className="saved-note">Kept with your account.</p>
          <FollowedShops />
        </>
      )}
      {tab === "searches" && (
        <>
          <p className="saved-note">{SEARCHES_NOTE}</p>
          <SavedSearches />
        </>
      )}
    </>
  );
}
