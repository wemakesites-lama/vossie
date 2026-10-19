import { Suspense } from "react";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { parseSavedTab, savedTabPath, type SavedTab } from "@/lib/following/rules";
import { FollowedShops } from "./FollowedShops";
import { SavedList } from "./SavedList";
import { SavedSkeleton } from "./SavedSkeleton";

type SavedTabsProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Saved's two tabs (community actions spec 2.17, plan decision 17): links, the open one marked aria-current, then the
 * tab's note and its list. It reads `?tab=`, so Saved's page puts it inside <Suspense>. The device note belongs to
 * Listings; Shops are kept with the account.
 *
 * It reads the tab here, then puts the rest inside a <Suspense> keyed by that tab (plan amendment 14): a client-side
 * switch makes a new boundary, so the skeleton shows while the other tab loads, never the old tab's content.
 */
export async function SavedTabs({ searchParams }: SavedTabsProps) {
  const tab = parseSavedTab((await searchParams).tab);
  return (
    <Suspense key={tab} fallback={<SavedSkeleton />}>
      <SavedTabContent tab={tab} />
    </Suspense>
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
        ]}
      />
      {tab === "listings" ? (
        <>
          <p className="saved-note">
            Saved on this device. Once Vossie is live, your saves will follow your account to any device.
          </p>
          <SavedList />
        </>
      ) : (
        <>
          <p className="saved-note">Kept with your account.</p>
          <FollowedShops />
        </>
      )}
    </>
  );
}
