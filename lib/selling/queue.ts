import { cache } from "react";
import { sellerQueue } from "@/lib/data/seller-queue";

/**
 * The shop's queue once per request (role views N2): the seller bar's Messages badge, the home's Needs you and a
 * thread's "Mark {title} as sold" read the same answer, so the badge always equals the row (spec 4.2). Request-time
 * only, inside <Suspense>; never "use cache": it is the owner's own state. Pass the signed-in account's own shop.
 */
export const queueFor = cache((sellerSlug: string) => sellerQueue(sellerSlug));
