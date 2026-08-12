export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-[7px] ${
          tone === "dark" ? "bg-navy-deep" : "bg-amber"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M12 3.5c3.4 3.2 5.4 6 5.4 8.7A5.4 5.4 0 0 1 12 17.6a5.4 5.4 0 0 1-5.4-5.4C6.6 9.5 8.6 6.7 12 3.5Z"
            stroke={tone === "dark" ? "#F2A51A" : "#071525"}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M4 20.5h16"
            stroke={tone === "dark" ? "#FBFAF7" : "#071525"}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className={`text-[1.15rem] font-semibold tracking-[-0.03em] ${
          tone === "dark" ? "text-navy-deep" : "text-porcelain"
        }`}
      >
        Commoda
      </span>
    </span>
  );
}