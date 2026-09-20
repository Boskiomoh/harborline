export function SkipLink({ label, href = "#main" }: { label: string; href?: string }) {
  return (
    <a
      href={href}
      className="sr-only rounded-full bg-accent px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      {label}
    </a>
  );
}
