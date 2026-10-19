import type { RequestRow } from "@/lib/data/rows";
import { requests } from "./requests";

// Part B's 16 sample requests as the store's rows (community actions plan decision 1). The fixtures stay as they are;
// the rows add what the store keeps: no asker (so no offer threads), the fixture's offers number as seedOffers, and
// nothing closed by anyone or hidden. Types only from lib, like every fixture.
export const sampleRequestRows: readonly RequestRow[] = requests.map((request) => ({
  id: request.id,
  askerId: null,
  title: request.title,
  categorySlug: request.categorySlug,
  campusSlug: request.campusSlug,
  details: request.details,
  budgetZar: request.budgetZar,
  swapWelcome: request.swapWelcome,
  neededBy: request.neededBy,
  status: request.status,
  createdAt: request.createdAt,
  updatedAt: request.createdAt,
  closedAt: null,
  seedOffers: request.offers,
  hiddenAt: null,
  hiddenReason: null,
}));
