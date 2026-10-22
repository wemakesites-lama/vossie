import type { Metadata } from "next";
import { Suspense } from "react";
import { NEW_POST_VALUES, PostEditor } from "@/components/staff/PostEditor";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { sellingErrors } from "@/lib/selling/errors";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { postFieldIds, staffErrors } from "@/lib/staff/errors";
import { postForm, postPrefix } from "@/lib/staff/form-state";
import { issueOnceToken } from "@/lib/staff/once";
import { HUB_MANAGE_PATH, HUB_NEW_PATH, hubEyebrow } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Write a post");
}

/** A new Hub post (staff tools spec 2.4). */
export default function NewPostPage() {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <NewPost />
      </Suspense>
    </PageTransition>
  );
}

async function NewPost() {
  const account = await requireStaff("hub", HUB_NEW_PATH);
  // A new post gets a one-time token, made now, at request time (staff tools amendment 15.7).
  const [campuses, state, once] = await Promise.all([getCampuses(), readFormState(postForm(null)), issueOnceToken()]);
  const ids = postFieldIds(postPrefix(null));
  const codes = state?.errors ?? [];
  return (
    <StaffFrame account={account} area={hubEyebrow(account)} title="Write a post" current={HUB_MANAGE_PATH} notice={null}>
      <PostEditor
        postId={null}
        values={state?.values ?? NEW_POST_VALUES}
        errors={[...staffErrors(codes, ids), ...sellingErrors(codes, { photos: ids.photos })]}
        preview={state?.notice === "preview" ? (state.values.body ?? "") : null}
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        coverSrc={null}
        once={once}
      />
    </StaffFrame>
  );
}
