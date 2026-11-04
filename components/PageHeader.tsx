import { Orbs } from './Orbs';

/**
 * The coloured band that opens the secondary pages (map, about, privacy),
 * matching the home hero. Pulled up under the transparent app bar.
 */
export function PageHeader({
  eyebrow, title, children,
}: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="aurora -mt-[calc(3.5rem+max(0.5rem,env(safe-area-inset-top)))] overflow-x-clip">
      <Orbs />
      <div className="mx-auto w-full max-w-[72rem] px-5 pb-24 pt-[calc(5.5rem+env(safe-area-inset-top))] md:px-8 md:pb-28">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--muted)' }}>
          {eyebrow}
        </p>
        <h1 className="mt-2 max-w-[18ch] text-balance text-[2.75rem] leading-[1.02] md:text-[4rem]">
          {title}
        </h1>
        {children}
      </div>
    </section>
  );
}
