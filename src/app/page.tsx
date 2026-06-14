export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <p className="text-sm uppercase tracking-[0.2em] text-foreground/40 mb-6">
        Coming soon
      </p>
      <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground mb-6">
        Under Construction
      </h1>
      <p className="text-lg text-foreground/60 max-w-sm">
        Something new is being built here. Check back soon.
      </p>
      <a
        href="mailto:ahmedyhussain07@gmail.com"
        className="mt-10 inline-block px-6 py-3 rounded-md border border-accent text-accent text-sm tracking-wide hover:bg-accent hover:text-background transition-colors"
      >
        Get in touch
      </a>
    </div>
  );
}
