import Link from "next/link";
import { RatioBar } from "@/components/charts/RatioBar";
import { CheckIcon } from "@/components/icons";

type Step = { label: string; done: boolean; href: string };

/**
 * A new shop's first steps (role views spec 5.2): "2 of 5 done", a bar, the steps, and the next one as the main
 * button. Every step completes itself from data; nothing is stored.
 */
export function SetupChecklist({ title, steps }: { title: string; steps: readonly Step[] }) {
  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);
  return (
    <section aria-label={title} className="kit-card setup">
      <h2 className="kit-section-title">{title}</h2>
      <p className="setup-count">
        {done} of {steps.length} done
      </p>
      <RatioBar done={done} total={steps.length} label={title} />
      <ol className="setup-steps">
        {steps.map((step) => (
          <li key={step.label} data-done={step.done ? "" : undefined}>
            {step.done ? (
              <>
                <CheckIcon /> <span className="sr-only">Done: </span>
                {step.label}
              </>
            ) : step === next ? (
              <Link href={step.href} prefetch={false} className="btn btn-primary">
                {step.label}
              </Link>
            ) : (
              <Link href={step.href} prefetch={false}>
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
