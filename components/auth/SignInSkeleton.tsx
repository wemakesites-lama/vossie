/** The card's room while this browser's step streams in, so the back link and the footer don't jump (spec 3.1). */
export function SignInSkeleton() {
  return <div className="signin-card signin-skeleton" aria-hidden="true" />;
}
