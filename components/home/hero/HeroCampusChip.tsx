import { CampusPickerButton } from "@/components/campus/CampusPickerButton";
import { ChevronDownIcon, MapPinIcon } from "@/components/icons";
import { ALL_CAMPUSES, campusLabel } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";

/** The phone's campus chip, the first thing in the hero panel (spec 6.2 and 7.3). It reads the cookie, so it streams in. */
export async function HeroCampusChip() {
  const [{ campus }, campuses] = await Promise.all([getViewerContext(), getCampuses()]);
  return (
    <ChipButton
      label={campus === ALL_CAMPUSES ? "Shopping all campuses" : `Shopping at ${campusLabel(campus, campuses)}`}
    />
  );
}

/** In the prerendered page until the cookie has been read. It already opens the picker. */
export function HeroCampusChipFallback() {
  return <ChipButton label="Choose your campus" />;
}

function ChipButton({ label }: { label: string }) {
  return (
    <CampusPickerButton className="hero-campus-chip">
      <MapPinIcon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      <ChevronDownIcon className="size-4 shrink-0" />
    </CampusPickerButton>
  );
}
