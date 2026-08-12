import type { ReactNode } from "react";

export function Section({
  children,
  className = "",
  tone = "porcelain",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "porcelain" | "sand" | "navy" | "white";
  id?: string;
}) {
  const tones = {
    porcelain: "bg-porcelain text-ink",
    sand: "bg-sand text-ink",
    white: "bg-card text-ink",
    navy: "bg-navy-deep text-porcelain",
  } as const;
  return (
    <section id={id} className={`${tones[tone]} ${className}`}>
      <div className="mx-auto w-full max-w-[1320px] px-5 py-16 sm:px-8 md:py-28">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <p className={`eyebrow ${tone === "dark" ? "text-slate" : "text-amber"}`}>{children}</p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  tone = "dark",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={`max-w-3xl ${className}`}>
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <h2
        className={`mt-3 text-3xl leading-[1.08] font-semibold sm:text-4xl md:text-[2.9rem] ${
          tone === "dark" ? "text-navy-deep" : "text-porcelain"
        }`}
      >
        {title}
      </h2>
      {lead ? (
        <p className={`mt-5 text-base leading-relaxed sm:text-lg ${tone === "dark" ? "text-slate" : "text-porcelain/70"}`}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}
