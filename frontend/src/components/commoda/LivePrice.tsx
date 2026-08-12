import { useQuery } from "@tanstack/react-query";
import { getBinanceLivePrice } from "@/lib/market-data/binance";
import type { MarketId } from "@/lib/commoda/types";
import { pct, usd } from "@/lib/commoda/format";
import { priceDigits } from "@/lib/commoda/markets";

export function LivePrice({ market, dark = false }: { market: MarketId; dark?: boolean }) {
  const { data, isPending, isError } = useQuery({ queryKey: ["marketPrice", "binance", market], queryFn: () => getBinanceLivePrice(market), refetchInterval: 20_000, staleTime: 15_000, refetchOnWindowFocus: true, retry: false });
  if (isPending) return <span className={dark ? "text-porcelain/60" : "text-slate"}>Loading price…</span>;
  if (isError || !data) return <span className={dark ? "text-porcelain/60" : "text-slate"}>Price unavailable</span>;
  const price = Number(data.price);
  const change = data.change24hPercent;
  return <span className="tabular-nums">{usd(price, priceDigits(market))}{change === null ? null : <span className={`ml-2 text-xs ${change < 0 ? "text-danger" : change > 0 ? "text-success" : "text-slate"}`}>{pct(change)} 24h</span>}</span>;
}
