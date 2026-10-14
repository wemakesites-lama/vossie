import Link from "next/link";

type SellPitchProps = {
  /** Where Start selling goes: through sign-in when signed out, else the wizard's first unanswered step. */
  startHref: string;
  /** A half-done application: the button says so. */
  resuming: boolean;
};

/**
 * The pitch (selling spec section 3): why sell on Vossie, the three steps, the fees (none), and Start selling. The
 * words are samples for Lama to change (plan decision 27).
 */
export function SellPitch({ startHref, resuming }: SellPitchProps) {
  return (
    <div className="sell-column">
      <header className="sell-head">
        <p className="eyebrow">Sell on Vossie</p>
        <h1 className="sell-title">Turn your hustle into a campus-wide business</h1>
        <p className="sell-lede">
          List what you make, sell or know, for students on every Eduvos campus. It&apos;s free.
        </p>
        <Link href={startHref} prefetch={false} className="btn btn-primary">
          {resuming ? "Continue setting up your shop" : "Start selling"}
        </Link>
      </header>

      <section aria-labelledby="sell-why-title" className="sell-section">
        <h2 id="sell-why-title" className="sell-section-title">
          Why sell here
        </h2>
        <ul className="sell-cards">
          <li>
            <strong>Buyers on your campus.</strong> Students find you by campus and category, and meet you at a pickup
            point you choose.
          </li>
          <li>
            <strong>Messages stay on Vossie.</strong> Buyers message you here, so your number stays yours.
          </li>
          <li>
            <strong>The Hub has your back.</strong> The Eduvos Incubation Hub checks every shop and helps you grow.
          </li>
        </ul>
      </section>

      <section aria-labelledby="sell-steps-title" className="sell-section">
        <h2 id="sell-steps-title" className="sell-section-title">
          Three steps
        </h2>
        <ol className="sell-cards sell-numbered">
          <li>Set up your shop: five short steps, about three minutes.</li>
          <li>The Hub checks it, usually within two working days.</li>
          <li>List what you sell, and answer buyers&apos; messages.</li>
        </ol>
      </section>

      <section aria-labelledby="sell-fees-title" className="sell-section">
        <h2 id="sell-fees-title" className="sell-section-title">
          Fees
        </h2>
        <p>None. Vossie takes no cut and sells no places. Buyers pay you when you meet.</p>
      </section>

      <p className="sell-note">
        Read the{" "}
        <Link href="/seller-guidelines" prefetch={false}>
          seller guidelines
        </Link>{" "}
        before you start.
      </p>
    </div>
  );
}
