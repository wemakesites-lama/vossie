import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequestView } from "@/components/looking-for/RequestView";
import { getCampuses, getCategories, getRequest, getRequestIds } from "@/lib/data";
import { shortDescription } from "@/lib/format";

/**
 * The tab title is the request's ("Accounting 1 tutor this week · Vossie"; the layout adds the suffix) and the
 * description the start of its details (community spec 4.2). A request names no one, so it's indexed: it helps
 * sellers find work. An unknown id gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/looking-for/[id]">): Promise<Metadata> {
  const { id } = await params;
  const request = await getRequest(id);
  if (!request) return { title: "Page not found" };
  return { title: request.title, description: shortDescription(request.details) };
}

export async function generateStaticParams() {
  return (await getRequestIds()).map((id) => ({ id }));
}

export default function RequestPage({ params }: PageProps<"/looking-for/[id]">) {
  return (
    // Known requests are prerendered, so this fallback only shows for an unknown id, until the 404 takes over.
    <Suspense fallback={null}>
      <RequestDetails params={params} />
    </Suspense>
  );
}

async function RequestDetails({ params }: Pick<PageProps<"/looking-for/[id]">, "params">) {
  const { id } = await params;
  const [request, categories, campuses] = await Promise.all([getRequest(id), getCategories(), getCampuses()]);
  const category = categories.find((item) => item.slug === request?.categorySlug);
  if (!request || !category) notFound();
  return (
    <RequestView
      request={request}
      category={category}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
    />
  );
}
