import { Suspense } from "react";
import { getViewerContext } from "@/lib/data/viewer";
import { ContextStripView } from "./ContextStripView";

/** The strip under the hero (spec 7.4). Until the viewer is known, it shows what a signed-out visitor sees. */
export function ContextStrip() {
  return (
    <section aria-labelledby="context-title" className="context-section">
      <Suspense fallback={<ContextStripView activity={null} />}>
        <ContextStripContent />
      </Suspense>
    </section>
  );
}

export async function ContextStripContent() {
  const { activity } = await getViewerContext();
  return <ContextStripView activity={activity} />;
}
