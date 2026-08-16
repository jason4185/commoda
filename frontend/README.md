# Commoda Protection Hub

Build a serious production-quality frontend for a GenLayer commodity price-drop protection protocol called COMMODA. This is the main frontend project, not a demo. Use React/TypeScript with Tailwind/shadcn and responsive design. Do not build a backend/database yet. Focus on polished frontend architecture and UX, with contract-backed reads and writes isolated behind a service layer.

PRODUCT
Commoda is fixed-payout commodity downside protection. Supported markets: WTI Crude Oil, Brent Crude Oil, Natural Gas. Users choose commodity, drop threshold (1%, 2%, 3%), duration (7, 14, 30 days), pay a fixed GEN premium, and receive a fixed GEN payout if both settlement sources confirm price <= stored trigger on a covered day. Product copy should say “price drop protection” / “drop protection”, not generic trading. Keep language clear and non-casino-like.

TERMS
7 days: premium 1 GEN; payout 2/3/4 GEN for 1/2/3% drop.
14 days: premium 2 GEN; payout 4/5/6 GEN.
30 days: premium 3 GEN; payout 6/8/10 GEN.
Purchase reference price comes from Gate and is locked at purchase. Settlement uses Binance + Gate historical daily closes. States: ACTIVE, CLAIMABLE, EXPIRED, CLAIMED, CANCELLED. Day results: UNPROCESSED, BREACHED, NOT_BREACHED, INCONCLUSIVE.

DESIGN DIRECTION — based on the reference screenshots I supplied in chat
Blend the strongest parts of Descartes Underwriting and our earlier Hedgix interface, but make Commoda visually distinct.
- Descartes inspiration: premium institutional insurance feel, generous white space, strong navy typography, large editorial headlines, full-width hero, image-led sections, accordion explanations, clear orange/amber call-to-action accents, modular industry/product cards.
- Hedgix inspiration: web3 app utility, wallet block in nav, “Get Protection” primary CTA, contract-oriented review panel, clean split-layout purchase flow, serious serif/editorial touches in selected hero/footer headings.
- Do NOT clone Descartes or Hedgix literally. Create a new Commoda identity.

COLOR SYSTEM — use this as the initial design system
- Deep Petroleum Navy: #071525 (primary dark / hero / footer)
- Commodity Blue: #10355F (secondary navy)
- Crude Amber: #F2A51A (primary CTA/accent; inspired by oil/gold tones)
- Warm Sand: #F4EFE6 (soft section/background)
- Porcelain: #FBFAF7 (main light canvas)
- Ink: #101828 (primary text)
- Slate: #667085 (secondary text)
- Success Green: #247A5A
- Warning/Incomplete: #B7791F
- Danger/Breach: #B42318
Use amber sparingly for action and emphasis, not as a full yellow page background. Aim for sophisticated commodity-risk / institutional-insurance energy.

TYPOGRAPHY
Use a strong modern grotesk/sans for UI and body. Pair it with a refined editorial serif for hero emphasis, section display words, and the footer statement. Avoid overusing serif. Large, confident typography like Descartes.

SITE STRUCTURE
Create these routes/pages now:
1. Home /
2. Get Protection /protect
3. Dashboard /dashboard
4. Markets /markets
5. How It Works /how-it-works
6. Transparency /transparency

GLOBAL NAV
Desktop nav: Commoda wordmark/logo left; Products, How It Works, Markets, Transparency center; right side wallet balance + shortened wallet address dropdown, View Dashboard secondary button, Get Protection primary dark/amber button depending on background. Sticky but elegant. Mobile collapses cleanly.

HOME PAGE
Hero should be premium and original, with dark petroleum navy background and a subtle commodity/oil-market visual treatment (abstract topographic lines, liquid contour, or refined data-grid motif rather than generic stock imagery). Headline direction: “Protection built for commodity price drops.” Supporting copy: predefined triggers, fixed payouts, independently verified market data. CTAs: Get Protection, How Settlement Works.
Add a compact three-market strip/cards for WTI, Brent, Natural Gas showing informational market data, supported drops, and availability.
Then a section inspired by Descartes’ “Parametrics at the core”: explain objective predefined triggers and transparent settlement.
Then a split image/data section: “Built on market data. Settled by consensus.” with accordion rows for Locked Reference Price, Dual-Source Settlement, Terminal Resolution / Fixed Payout.
Then a 3-step visual process: Choose protection → Lock terms → Settle from verified data.
Then market/product cards for WTI / Brent / Natural Gas.
Then trust/transparency section with protocol stats cards: Pool Balance, Reserved Liability, Active Protections, Payouts Paid.
Then strong CTA section and premium dark footer.

GET PROTECTION PAGE
This is the core app page. Use a split layout inspired by the Hedgix screenshot but redesigned for Commoda.
Left: step-based selection area.
1 Choose Commodity: WTI / BRENT / NATGAS cards with display names.
2 Choose Drop: 1%, 2%, 3% segmented cards.
3 Choose Duration: 7 / 14 / 30 days.
Show a “Locked reference price” explainer box: determined during purchase from Gate and stored with the protection.
Right: sticky “Review Protection” panel with market, drop trigger, trigger rule, premium, payout, duration, expected start/end, reference-price source, settlement sources. Primary button “Review & Protect”.
Use correct economics from the table above. Any trigger preview must be labelled clearly as a preview until purchase locks the actual price.
Add transaction review modal with exact premium, payout, selected terms, source explanation, and wallet confirmation state.

DASHBOARD
Institutional risk dashboard, not a crypto toy. Top summary: Active, Claimable, Expired, Cancelled, Total Premiums, Total Payouts. Protection cards/table with ID, Market, Drop, Reference, Trigger, Duration, Settled Days, Next Settlement Date, State, Last Result. Clear state badges. Detail drawer/page for one protection with daily settlement timeline and evidence summary. Buttons: Settle (when ready), Cancel & Refund (when eligible), Claim Payout (when claimable). Include accepted transaction state handling.

MARKETS
Three large market cards / detail sections for WTI, Brent, Natural Gas. Explain each market, available drop levels and durations, and source symbols. Protocol terms and state come from the contract service; any live market ticker is informational only.

HOW IT WORKS
Editorial explainer: Purchase reference → Coverage days → Daily settlement → Breach / Not breached / Inconclusive → Claim, expiry or terminal cancellation/refund. Explain that both Binance and Gate must be on the breach side for BREACHED; disagreement is INCONCLUSIVE and retried. Use diagrams/cards, not long walls of text.

TRANSPARENCY
Show contract-derived pool state, contract architecture, market source table, settlement rule, and links for Contract Explorer and GitHub. Include a section “What validators verify” explaining that validators independently fetch the external market evidence; they are not just checking JSON formatting.

FOOTER
Dark petroleum footer with an editorial line such as: “Defined protection. Verified markets. Transparent settlement.” Columns: Protocol, App, Resources. Keep this inspired by the Hedgix footer proportions but visually Commoda.

COMPONENT/UX REQUIREMENTS
- Create a reusable design system with CSS variables/tokens.
- Use polished hover/focus/disabled states.
- Responsive desktop/tablet/mobile.
- Strong accessibility contrast.
- No excessive gradients, glassmorphism, neon crypto aesthetic, or generic SaaS purple.
- No fake AI claims.
- No “insurance policy” legal promises; use “protection” in user-facing copy.
- Isolate contract reads and writes in a typed service/data layer.
- Add concise loading/skeleton/empty/error states to app pages.
- Build real routing and reusable components, not one giant landing page.

Make the first iteration visually strong enough that we can inspect the live preview and then refine section by section. Do not deploy/publish automatically.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6743d8e3-fa0a-4131-baae-7e6ef48bf4ce).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
