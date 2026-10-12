import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { setCampusChoice } from "@/lib/campus";
import { showToast } from "@/lib/toast";
import type { Campus, CampusChoice } from "@/lib/types";

/**
 * Choose a campus (spec 6.4): remember it, confirm it, and re-render the campus-aware server sections.
 * Close any dialog first: a toast isn't announced while a modal is open.
 */
export function useChooseCampus(campuses: readonly Pick<Campus, "slug" | "name">[]) {
  const router = useRouter();
  return useCallback(
    (choice: CampusChoice) => {
      setCampusChoice(choice);
      const name = campuses.find((campus) => campus.slug === choice)?.name;
      showToast(name ? `Showing ${name} first` : "Showing all campuses");
      router.refresh();
    },
    [campuses, router],
  );
}
