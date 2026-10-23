import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ChartNoAxesCombined, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FutureAsset = { key: string; title: string; symbol: string; unit: string };
const assets: FutureAsset[] = [
  { key: "boi", title: "Boi Gordo", symbol: "BGI1!", unit: "R$/@" },
  { key: "soja", title: "Soja", symbol: "SJC1!", unit: "US$/saca de 60 kg" },
  { key: "milho", title: "Milho", symbol: "CCM1!", unit: "R$/saca de 60 kg" },
];

const FutureChartPanel = ({ item, refresh }: { item: FutureAsset; refresh: number }) => {
  const source = `https://br.tradingview.com/symbols/BMFBOVESPA-${item.symbol}/`;
  const hostRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setFailed(false);
    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    container.style.width = "100%";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: [[`${item.title} · B3`, `BMFBOVESPA:${item.symbol}|1D`]],
      chartType: "line", lineWidth: 2, lineType: 0,
      colorTheme: resolvedTheme === "dark" ? "dark" : "light",
      backgroundColor: resolvedTheme === "dark" ? "#141C18" : "#F6F1EA",
      isTransparent: false, locale: "br", autosize: true,
      width: "100%", height: "100%", chartOnly: false,
      scalePosition: "right", scaleMode: "Normal", noTimeScale: false,
      hideDateRanges: false, hideMarketStatus: false, hideSymbolLogo: false,
      dateRanges: ["1m|1D", "3m|1D", "12m|1D", "60m|1W", "all|1M"],
      fontSize: "12", headerFontSize: "medium", valuesTracking: "1",
      changeMode: "price-and-percent",
    });
    script.onerror = () => setFailed(true);
    container.append(widget, script);
    host.replaceChildren(container);
    return () => {
      script.onerror = null;
      host.replaceChildren();
    };
  }, [resolvedTheme, refresh, item.symbol, item.title]);

  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{item.title}</span> · B3 · {item.unit} · {item.symbol}</p>
    {failed && <p role="status" className="rounded-lg border border-border bg-muted p-4 text-center text-sm text-muted-foreground">Não foi possível carregar o gráfico. Consulte a fonte pelo botão abaixo.</p>}
    <div ref={hostRef} role="region" aria-label={`Gráfico histórico de ${item.title} na B3`} className={`${failed ? "hidden" : "block"} h-[420px] w-full overflow-hidden rounded-lg border border-border bg-[#F6F1EA] dark:bg-[#141C18] sm:h-[520px] lg:h-[600px]`} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="tradingview-widget-copyright text-xs text-muted-foreground"><a href={source} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">Gráfico de {item.title} por TradingView</a></div>
      <Button asChild variant="outline" size="sm" className="h-10"><a href={source} target="_blank" rel="noopener noreferrer">Abrir gráfico<ExternalLink className="size-3.5" /></a></Button>
    </div>
  </div>;
};

export const FuturesChart = ({ refresh }: { refresh: number }) => <Card className="min-w-0 overflow-hidden">
  <CardHeader className="space-y-2 pb-4">
    <div className="flex items-center gap-2"><ChartNoAxesCombined className="size-5 shrink-0 text-primary" /><CardTitle className="text-lg">Gráficos da B3</CardTitle></div>
    <p className="text-sm text-muted-foreground">Escolha o produto e acompanhe a evolução dos contratos futuros.</p>
  </CardHeader>
  <CardContent className="space-y-4">
    <Tabs defaultValue="boi" className="min-w-0 space-y-4">
      <TabsList aria-label="Produto do mercado futuro" className="grid h-12 w-full grid-cols-3 sm:max-w-md">
        {assets.map(item => <TabsTrigger key={item.key} value={item.key} className="min-h-10 px-2 text-xs sm:text-sm">{item.title}</TabsTrigger>)}
      </TabsList>
      {assets.map(item => <TabsContent key={item.key} value={item.key} className="min-w-0"><FutureChartPanel item={item} refresh={refresh} /></TabsContent>)}
    </Tabs>
    <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">Dados da B3 exibidos por TradingView, sujeitos a atraso. As séries contínuas reúnem contratos ao longo do tempo; mostram a evolução histórica, não uma previsão de preço nem uma curva por vencimento. Confira período, unidade e data no gráfico.</p>
  </CardContent>
</Card>;
