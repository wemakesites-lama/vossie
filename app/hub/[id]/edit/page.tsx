import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostEditor, postValues } from "@/components/staff/PostEditor";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { canEditPost, getPostRow } from "@/lib/data/hub-posts";
import { isId } from "@/lib/messaging/paths";
import { sellingErrors } from "@/lib/selling/errors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { postFieldIds, staffErrors } from "@/lib/staff/errors";
import { postForm, postPrefix } from "@/lib/staff/form-state";
import { editPostPath, HUB_MANAGE_PATH, hubEyebrow } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Edit a post");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no post. */
export function generateStaticParams() {
  return [{ id: "h-sample" }];
}

/** Editing a post (staff tools spec 2.4): its author, or an admin. Anyone else, or an unknown post, gets the 404. */
export default function EditPostPage({ params }: PageProps<"/hub/[id]/edit">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <EditPost params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function EditPost({ params }: Pick<PageProps<"/hub/[id]/edit">, "params">) {
  const { id } = await params;
  // The role first, so someone without it gets the 404 whatever the address says (plan decision 1).
  const account = await requireStaff("hub", editPostPath(id));
  const row = isId(id) ? await getPostRow(id) : null;
  if (!row || !canEditPost(account, row)) notFound();
  const [campuses, state] = await Promise.all([getCampuses(), readFormState(postForm(id))]);
  const ids = postFieldIds(postPrefix(id));
  const codes = state?.errors ?? [];
  return (
    <StaffFrame account={account} area={hubEyebrow(account)} title={`Edit ${row.title}`} current={HUB_MANAGE_PATH} notice={null}>
      <PostEditor
        postId={id}
        values={state?.values ?? postValues(row)}
        errors={[...staffErrors(codes, ids), ...sellingErrors(codes, { photos: ids.photos })]}
        preview={state?.notice === "preview" ? (state.values.body ?? "") : null}
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        coverSrc={row.image.src}
      />
    </StaffFrame>
  );
}
