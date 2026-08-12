import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/commoda/Logo";

const COLUMNS = [
  {
    title: "Protocol",
    links: [
      { label: "How It Works", to: "/how-it-works" as const },
      { label: "Transparency", to: "/transparency" as const },
      { label: "Markets", to: "/markets" as const },
    ],
  },
  {
    title: "App",
    links: [
      { label: "Get Protection", to: "/protect" as const },
      { label: "Dashboard", to: "/dashboard" as const },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GenLayer", to: "/how-it-works" as const },
      { label: "GitHub", to: "/transparency" as const },
      { label: "Contract Explorer", to: "/transparency" as const },
    ],
  },
];

export function Footer() {
  return (
    <footer className="surface-dark">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-16 sm:px-8 md:py-24">
        <p className="font-display max-w-3xl text-3xl leading-[1.15] text-porcelain sm:text-4xl md:text-5xl">
          Defined protection. Verified markets. Transparent settlement.
        </p>

        <div className="mt-14 grid gap-10 border-t border-porcelain/12 pt-12 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div className="min-w-0">
            <Logo tone="light" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-porcelain/60">
              Fixed-payout commodity price drop protection, settled from independently verified
              market data on GenLayer.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="eyebrow text-amber">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-porcelain/75 transition-colors hover:text-porcelain"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="eyebrow text-amber">Resources</h3>
            <ul className="mt-4 space-y-3 text-sm text-porcelain/75">
              <li>Contract Explorer (coming soon)</li>
              <li>GitHub (coming soon)</li>
              <li>Documentation (coming soon)</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-porcelain/12 pt-6 text-xs text-porcelain/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Commoda. All figures shown are demo data.</p>
          <p>Commoda provides protection products, not insurance contracts.</p>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-porcelain/12 pt-5 text-xs text-porcelain/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Commoda Protocol · v1</span>
          <span>Review product terms and contract state before every action.</span>
        </div>
      </div>
    </footer>
  );
}
