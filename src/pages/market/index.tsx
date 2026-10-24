import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Beef, ExternalLink, Info, Leaf, LoaderCircle, RefreshCw, Maximize2, Minimize2, Wheat } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FuturesChart } from "./futures-chart";
import "./market.css";

const base = "https://www.noticiasagricolas.com.br";
type Market = { key: string; title: string; subtitle: string; href: string; widget?: number; note?: string; height?: number; icon: typeof Beef };
const bovines: Market[] = [
  { key: "boi", title: "Boi Gordo", subtitle: "Mercado físico · R$/@ · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/indicador-do-boi`, widget: 298, height: 340, icon: Beef },
  { key: "vaca", title: "Vaca Gorda", subtitle: "Mercado físico · R$/@ · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/indicador-da-vaca`, widget: 300, height: 340, icon: Beef },
  { key: "novilha", title: "Novilha", subtitle: "Mercado físico · R$/@ · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/indicador-da-novilha`, widget: 301, height: 340, icon: Beef },
  { key: "bezerro", title: "Bezerro", subtitle: "Reposição Nelore macho · R$/kg vivo · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/reposicao-nelore-macho`, widget: 302, height: 380, note: "Consulte a coluna Bezerro (180 a 240 kg). A fonte também mostra outras categorias de reposição. Referências de SP, MG, MS, MT, GO, TO, PA, PR, RS e RO; a cobertura não inclui todas as unidades federativas.", icon: Beef },
];
const physical: Market[] = [
  { key: "soja", title: "Soja", subtitle: "Mercado físico · R$/saca de 60 kg · diversas praças", href: `${base}/cotacoes/soja`, widget: 127, icon: Leaf },
  { key: "milho", title: "Milho", subtitle: "Mercado físico · R$/saca de 60 kg · diversas praças", href: `${base}/cotacoes/milho`, widget: 130, icon: Wheat },
  { key: "sorgo", title: "Sorgo", subtitle: "Mercado físico · R$/saca · praças disponíveis na fonte", href: `${base}/cotacoes/sorgo/sorgo-mercado-fisico-media`, widget: 216, icon: Wheat },
];


const SourceLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Button asChild variant="outline" size="sm" className="h-10 max-w-full shrink-0 gap-2 whitespace-nowrap">
    <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink className="size-3.5 shrink-0" /></a>
  </Button>
);

const MarketInfo = ({ item }: { item: Market }) => {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}><TooltipTrigger asChild><button type="button" aria-label={`Informações da cotação de ${item.title}`} onClick={()=>setOpen(value=>!value)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><Info className="size-4" /></button></TooltipTrigger><TooltipContent className="max-w-[min(22rem,calc(100vw-2rem))] space-y-2 text-xs leading-relaxed"><p>Tabela do Notícias Agrícolas. Confira a data, a unidade e a fonte indicadas na tabela. O modo Ajustado reduz o quadro para caber na largura disponível. Use Ampliar se precisar ler em tamanho maior; nesse modo, a rolagem pode ser necessária.</p>{item.note && <p>{item.note}</p>}<p>Se a tabela não carregar, use Fonte e histórico.</p></TooltipContent></Tooltip>;
};

const MarketTable = ({ item, refresh }: { item: Market; refresh: number }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [loaded, setLoaded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [fit, setFit] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const baseWidth = item.key === "bezerro" ? 960 : 600;
  const frameHeight = item.height ?? 320;
  const scale = fit && availableWidth > 0 ? Math.min(1, availableWidth / baseWidth) : 1;
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => setAvailableWidth(frame.clientWidth));
    setAvailableWidth(frame.clientWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const params = new URLSearchParams({
    id: String(item.widget), largura: "100%", fonte: "Arial, Helvetica, sans-serif", tamanho: "12pt",
    // O provedor mantém linhas brancas que não aceitam os parâmetros de cor.
    // Partimos de uma paleta clara legível; a escala de cinza evita tons marrons
    // na inversão usada no dark, sem interferir nos dados do provedor.
    corcabecalho: "E1E5E9", cortexto: "20252A",
    corlinha: "F1F3F5", imagem: "false",
  });
  const src = `${base}/widgets/cotacoes?${params}`;
  useEffect(() => {
    setLoaded(false);
    setWaiting(false);
    const timer = window.setTimeout(() => setWaiting(true), 12000);
    return () => window.clearTimeout(timer);
  }, [src, refresh]);
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p><MarketInfo item={item} />
      </div>
        {item.widget ? <>
          <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{fit ? "Ajustado à largura" : "Tamanho de leitura ampliado"}</span><Button variant="outline" size="sm" className="h-9 shrink-0 text-xs" onClick={() => setFit(current => !current)} aria-pressed={!fit}>{fit ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}{fit ? "Ampliar tabela" : "Ajustar tabela"}</Button></div>
          <div className="relative overflow-hidden rounded-lg border border-border bg-white dark:bg-[#1a1a1a]">
            {!loaded && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card px-4 py-5 text-center" role="status" aria-live="polite" aria-atomic="true">
              <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" /></div>
              <div className="max-w-xs space-y-2"><p className="text-sm font-semibold text-foreground">Carregando cotações de {item.title}…</p><p className="text-xs leading-relaxed text-muted-foreground">{waiting ? "A fonte está demorando a responder. Você pode consultá-la diretamente." : "Aguarde um instante enquanto buscamos a tabela."}</p></div>
              <div className="w-full max-w-52 space-y-2 motion-safe:animate-pulse" aria-hidden="true"><div className="h-2 rounded-full bg-primary/15" /><div className="mx-auto h-2 w-5/6 rounded-full bg-primary/10" /><div className="mx-auto h-2 w-2/3 rounded-full bg-primary/10" /></div>
              {waiting && <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Consultar fonte<ExternalLink className="size-3.5" aria-hidden="true" /></a>}
            </div>}
            <div ref={frameRef} role="region" aria-label={`Tabela de ${item.title}: ${fit ? "ajustada à largura" : "role para ver todas as colunas"}`} tabIndex={0} className={`market-table-scroll rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${fit ? "overflow-hidden" : "overflow-auto"}`} style={{height: frameHeight * scale}}>
            <iframe key={`${refresh}-${src}`} src={src} title={`Cotações: ${item.title}`} width="100%" height={frameHeight}
              className={`block border-0 ${loaded ? "visible" : "invisible"}`} aria-hidden={!loaded} tabIndex={loaded ? 0 : -1} referrerPolicy="strict-origin-when-cross-origin"
              style={{ width: scale < 1 ? baseWidth : "100%", minWidth: baseWidth, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: "top left", colorScheme: "light", backgroundColor: "#FFFFFF", filter: isDark ? "grayscale(1) invert(0.9)" : undefined }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setWaiting(true); }} />
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Notícias Agrícolas · data e fonte na tabela · use Ampliar para ler em tamanho maior.</p>
        </> : <div className="flex min-h-36 flex-col justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
          <BarChart3 className="size-7 text-muted-foreground" />
          <p className="text-sm leading-relaxed">Consulte cotações, datas e referências diretamente na página da fonte.</p>
          <p className="text-xs text-muted-foreground">Consulta externa · abre em outra aba.</p>
        </div>}

    </div>
  );
};

const MarketCard = ({ item, refresh }: { item: Market; refresh: number }) => {
  const Icon = item.icon;
  return <Card className="min-w-0 overflow-hidden">
    <CardHeader className="p-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Icon className="size-5 shrink-0 text-primary" /><CardTitle className="font-sans text-base font-semibold">{item.title}</CardTitle></div><SourceLink href={item.href}>Fonte e histórico</SourceLink></div>
    </CardHeader>
    <CardContent className="px-4 pb-4"><MarketTable item={item} refresh={refresh} /></CardContent>
  </Card>;
};

const BovinesCard = ({ refresh }: { refresh: number }) => {
  const [category, setCategory] = useState("boi");
  const selected = bovines.find(item=>item.key===category) ?? bovines[0];
  return <Card className="min-w-0 overflow-hidden"><Tabs value={category} onValueChange={setCategory} className="min-w-0">
    <CardHeader className="p-4 pb-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Beef className="size-5 shrink-0 text-primary" /><CardTitle className="font-sans text-base font-semibold">BOVINOS</CardTitle></div>
        <div className="market-bovine-tabs order-3 w-full max-w-full lg:order-none lg:w-auto">
          <TabsList aria-label="Categoria de bovinos" className="grid h-auto w-full grid-cols-2 gap-1 min-[420px]:grid-cols-4 lg:w-auto">
            {bovines.map(item=><TabsTrigger key={item.key} value={item.key} className="min-h-10 shrink-0 px-4 text-xs sm:text-sm">{item.title}</TabsTrigger>)}
          </TabsList>
        </div>
        <SourceLink href={selected.href}>Fonte e histórico</SourceLink>
      </div>
    </CardHeader>
    <CardContent className="px-4 pb-4">
      {bovines.map(item=><TabsContent key={item.key} value={item.key} className="mt-0 min-w-0"><MarketTable item={item} refresh={refresh} /></TabsContent>)}
    </CardContent>
  </Tabs></Card>;
};

const MarketPage = () => {
  const [refresh, setRefresh] = useState(0);
  return (
    <TooltipProvider><div className="market-page min-w-0 space-y-4">
      <PageHeader titleKey="nav.market" subtitleKey="market.subtitle"
        actions={<Button variant="outline" className="h-10" onClick={() => setRefresh(value => value + 1)}><RefreshCw className="size-4" />Recarregar cotações</Button>} />
      <Tabs defaultValue="physical" className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold"><BarChart3 className="size-4 shrink-0 text-primary" />Acompanhe o mercado</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">Arroba e grãos. Confira a data e a unidade em cada fonte.</p>
          </div>
          <TabsList aria-label="Tipo de mercado" className="grid h-11 w-full grid-cols-2 md:w-auto md:shrink-0">
            <TabsTrigger value="physical" className="h-9 min-w-0 px-2 text-xs sm:px-4 sm:text-sm">Mercado físico</TabsTrigger>
            <TabsTrigger value="futures" className="h-9 min-w-0 px-2 text-xs sm:px-4 sm:text-sm">Mercado futuro</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="physical" className="space-y-4">
          <p className="text-sm text-muted-foreground">Preços por praça. Confira condições de pagamento, impostos e frete na fonte antes de comparar.</p>
          <BovinesCard refresh={refresh} />
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{physical.map(item => <MarketCard key={item.key} item={item} refresh={refresh} />)}</div>
        </TabsContent>
        <TabsContent value="futures" className="space-y-4">
          <FuturesChart refresh={refresh} />
        </TabsContent>
      </Tabs>
      <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Tabelas disponibilizadas por Notícias Agrícolas e pelas fontes identificadas; gráficos de contratos da B3 por TradingView. A atualização depende de cada provedor; recarregar não altera a data da cotação. Valores de referência, sujeitos às condições de cada praça e contrato.</p>
    </div></TooltipProvider>
  );
};

export default MarketPage;
