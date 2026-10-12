"use client";

import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/icons";
import { useCampusChoice } from "@/hooks/useCampusChoice";
import { ALL_CAMPUSES } from "@/lib/campus";
import type { Campus } from "@/lib/types";

/** The footer's giant "Shop your campus" link: the chosen campus, or everything. */
export function ShopYourCampusLink({ campuses }: { campuses: readonly Campus[] }) {
  const choice = useCampusChoice(campuses);
  const href = choice && choice !== ALL_CAMPUSES ? `/c/${choice}` : "/browse";
  return (
    <Link href={href} className="footer-giant">
      Shop your campus
      <ArrowUpRightIcon className="footer-giant-arrow" />
    </Link>
  );
}
