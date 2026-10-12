import { getCampuses } from "@/lib/data";
import { CampusChooser } from "./CampusChooser";
import { SectionHeader } from "./SectionHeader";

/** Shop by campus (spec 7.7). The campus comes from the cookie on the device, so the section is prerendered whole. */
export async function ShopByCampus() {
  const campuses = await getCampuses();
  return (
    <section aria-labelledby="campuses-title" className="home-section">
      <SectionHeader id="campuses" eyebrow="Shop by campus" align="center" />
      <CampusChooser campuses={campuses} />
    </section>
  );
}
