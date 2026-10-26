import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTransition } from "@/components/kit/PageTransition";
import { Reveal } from "@/components/kit/Reveal";
import { RequestView } from "@/components/looking-for/RequestView";
import { PageFallback } from "@/components/ui/PageFallback";
import { getCampuses, getCategories, getRequest, getRequestIds } from "@/lib/data";
import { shortDescription } from "@/lib/format";
import { atLeastOne, PLACEHOLDER_PARAMS } from "@/lib/static-params";

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

/** Every request's page; on an empty database, a placeholder whose page is the 404 (2b plan Task 17b). */
export async function generateStaticParams() {
  return atLeastOne(
    (await getRequestIds()).map((id) => ({ id })),
    PLACEHOLDER_PARAMS.request,
  );
}

export default function RequestPage({ params }: PageProps<"/looking-for/[id]">) {
  return (
    // Known requests are prerendered, but the fallback still shows while the page streams in (see PageFallback), and
    // for an unknown id until the 404 takes over.
    <PageTransition>
      <Reveal fallback={<PageFallback />}>
        <RequestDetails params={params} />
      </Reveal>
    </PageTransition>
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
