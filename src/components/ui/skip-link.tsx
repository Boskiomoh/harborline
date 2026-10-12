import Link from "next/link";
import { FC } from "react";

interface SkipLinkProps {
  label: string;
  href?: string;
}

const SkipLink: FC<SkipLinkProps> = ({ label, href = "#main" }) => (
  <Link
    href={href}
    className="sr-only rounded-full bg-accent px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
  >
    {label}
  </Link>
);

export { SkipLink };
