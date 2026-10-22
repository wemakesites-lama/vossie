import { isDemoSignIn, isSampleMode } from "@/lib/auth/config";
import { getSignInView } from "@/lib/auth/sign-in-view";
import { getCampuses } from "@/lib/data";
import { getSampleSignIns } from "@/lib/data/accounts";
import { CodeStep, EmailStep, ProfileStep, SignedInNote, SignInUnavailable } from "./SignInSteps";

/** The sign-in card for this browser's state (accounts spec 3.1). Request-time: it sits inside <Suspense> on /login. */
export async function SignIn({ next }: { next: string | null }) {
  const view = await getSignInView();
  switch (view.step) {
    case "unavailable":
      return <SignInUnavailable />;
    case "signed-in":
      return <SignedInNote email={view.email} next={next} />;
    case "code":
      return (
        <CodeStep
          next={next}
          maskedEmail={view.maskedEmail}
          errors={view.errors}
          resent={view.resent}
          sampleCode={view.sampleCode}
        />
      );
    case "profile":
      return (
        <ProfileStep
          next={next}
          firstName={view.firstName}
          campus={view.campus}
          campuses={await getCampuses()}
          errors={view.errors}
        />
      );
    case "email":
      return (
        <EmailStep
          next={next}
          email={view.email}
          consented={view.consented}
          errors={view.errors}
          samples={isSampleMode() || isDemoSignIn() ? await getSampleSignIns() : null}
        />
      );
  }
}
