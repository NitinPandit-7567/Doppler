export default function LandingPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
        AI-Powered CS2 Skin
        <br />
        Market Intelligence
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Doppler hunts deals, reads patches, and trades on your behalf — within limits you control.
      </p>
      <div className="mt-10">
        <a
          href="/login"
          className="rounded-lg bg-primary px-8 py-3 text-lg font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Get Started
        </a>
      </div>
    </section>
  );
}
