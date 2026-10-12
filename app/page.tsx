const COMING_IN_PART_2 = [
  "Shop by category",
  "Collections",
  "Shop by campus",
  "Just listed",
  "How it works",
  "Featured today",
  "Looking For",
  "Free & swaps",
  "Hub and What's on",
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-page px-2.5 pb-16 sm:px-4 wide:px-8">
      <section
        aria-labelledby="hero-title"
        className="surface-navy texture-stars rounded-panel px-5 pb-12 pt-14 wide:px-12 wide:pb-20 wide:pt-24"
      >
        <p className="eyebrow text-white">The Eduvos student marketplace</p>
        <h1 id="hero-title" className="mt-3 max-w-[14ch] font-display text-hero uppercase">
          Buy &amp; sell <span className="text-sky">textbooks</span> on campus
        </h1>
        <p className="mt-5 max-w-[46ch] text-white/80">
          The site shell is in place. The full homepage arrives in Part 2 of the build.
        </p>
      </section>
      <ol aria-label="Homepage sections arriving in Part 2" className="mt-12 grid gap-4">
        {COMING_IN_PART_2.map((name) => (
          <li
            key={name}
            className="grid min-h-[38vh] place-items-center rounded-panel border-[1.5px] border-dashed border-line text-muted"
          >
            {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
