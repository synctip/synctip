import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared layout for legal / long-form pages (privacy, terms). Keeps
 * typography consistent without pulling in @tailwindcss/typography.
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-10 py-4">
      <header className="space-y-3 border-b pb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Legal
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
      </header>
      <div className="space-y-10 leading-7 text-foreground/90">{children}</div>
    </article>
  );
}

export function LegalSection({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("space-y-3", className)}>
      <h2 className="scroll-mt-24 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-muted-foreground/50">
      {children}
    </ul>
  );
}
