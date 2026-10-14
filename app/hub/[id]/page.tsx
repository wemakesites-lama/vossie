import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HubPostView } from "@/components/hub/HubPostView";
import { getCampuses, getHubPost, getHubPostIds } from "@/lib/data";
import { shortDescription } from "@/lib/format";
import { markdownText } from "@/lib/markdown";

/**
 * The tab title is the post's ("Pitch night · Vossie"; the layout adds the suffix) and the description the start of
 * its body as plain words (community spec 5.2). Link previews use the one-line summary (plan decision 14). An unknown
 * id gets the 404's title.
 */
export async function generateMetadata({ params }: PageProps<"/hub/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await getHubPost(id);
  if (!post) return { title: "Page not found" };
  return {
    title: post.title,
    description: shortDescription(markdownText(post.body)),
    openGraph: { title: post.title, description: post.summary },
  };
}

export async function generateStaticParams() {
  return (await getHubPostIds()).map((id) => ({ id }));
}

export default function HubPostPage({ params }: PageProps<"/hub/[id]">) {
  return (
    // Known posts are prerendered, so this fallback only shows for an unknown id, until the 404 takes over.
    <Suspense fallback={null}>
      <PostDetails params={params} />
    </Suspense>
  );
}

async function PostDetails({ params }: Pick<PageProps<"/hub/[id]">, "params">) {
  const { id } = await params;
  const [post, campuses] = await Promise.all([getHubPost(id), getCampuses()]);
  if (!post) notFound();
  return <HubPostView post={post} campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))} />;
}
