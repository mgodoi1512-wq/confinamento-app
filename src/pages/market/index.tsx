import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BarChart3, Beef, ExternalLink, Leaf, LoaderCircle, RefreshCw, Wheat } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FuturesChart } from "./futures-chart";

const base = "https://www.noticiasagricolas.com.br";
type Market = { key: string; title: string; subtitle: string; href: string; widget?: number; note?: string; icon: typeof Beef };
const bovines: Market[] = [
  { key: "boi", title: "Boi Gordo", subtitle: "Mercado físico · R$/@ · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/indicador-do-boi`, widget: 298, icon: Beef },
  { key: "vaca", title: "Vaca Gorda", subtitle: "Mercado físico · R$/@ · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/indicador-da-vaca`, widget: 300, icon: Beef },
  { key: "novilha", title: "Novilha", subtitle: "Mercado físico · R$/@ · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/indicador-da-novilha`, widget: 301, icon: Beef },
  { key: "bezerro", title: "Bezerro", subtitle: "Reposição Nelore macho · R$/kg vivo · estados disponíveis · Datagro", href: `${base}/cotacoes/boi-gordo/reposicao-nelore-macho`, widget: 302, note: "Consulte a coluna Bezerro (180 a 240 kg). A fonte também mostra outras categorias de reposição. Referências de SP, MG, MS, MT, GO, TO, PA, PR, RS e RO; a cobertura não inclui todas as unidades federativas.", icon: Beef },
];
const physical: Market[] = [
  { key: "soja", title: "Soja", subtitle: "Mercado físico · R$/saca de 60 kg · diversas praças", href: `${base}/cotacoes/soja`, widget: 127, icon: Leaf },
  { key: "milho", title: "Milho", subtitle: "Mercado físico · R$/saca de 60 kg · diversas praças", href: `${base}/cotacoes/milho`, widget: 130, icon: Wheat },
  { key: "sorgo", title: "Sorgo", subtitle: "Mercado físico · R$/saca · praças disponíveis na fonte", href: `${base}/cotacoes/sorgo/sorgo-mercado-fisico-media`, widget: 216, icon: Wheat },
];


const SourceLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Button asChild variant="outline" size="sm" className="h-10 max-w-full gap-2">
    <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink className="size-3.5 shrink-0" /></a>
  </Button>
);

const MarketTable = ({ item, refresh }: { item: Market; refresh: number }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [loaded, setLoaded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const params = new URLSearchParams({
    id: String(item.widget), largura: "100%", fonte: "Arial, Helvetica, sans-serif", tamanho: "12pt",
    // O provedor mantém linhas brancas que não aceitam os parâmetros de cor.
    // Partimos de uma paleta clara legível e adaptamos o iframe inteiro no dark.
    corcabecalho: "E8D7C4", cortexto: "392A20",
    corlinha: "F6F1EA", imagem: "false",
  });
  const src = `${base}/widgets/cotacoes?${params}`;
  useEffect(() => {
    setLoaded(false);
    setWaiting(false);
    const timer = window.setTimeout(() => setWaiting(true), 12000);
    return () => window.clearTimeout(timer);
  }, [src, refresh]);
  return (
    <div className="space-y-3">
        {item.widget ? <>
          <div className="relative overflow-hidden rounded-lg border border-border bg-white dark:bg-[#141C18]">
            {!loaded && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-card px-5 py-8 text-center" role="status" aria-live="polite" aria-atomic="true">
              <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><LoaderCircle className="size-7 motion-safe:animate-spin" aria-hidden="true" /></div>
              <div className="max-w-xs space-y-2"><p className="text-sm font-semibold text-foreground">Carregando cotações de {item.title}…</p><p className="text-xs leading-relaxed text-muted-foreground">{waiting ? "A fonte está demorando a responder. Você pode consultá-la diretamente." : "Aguarde um instante enquanto buscamos a tabela."}</p></div>
              <div className="w-full max-w-52 space-y-2 motion-safe:animate-pulse" aria-hidden="true"><div className="h-2 rounded-full bg-primary/15" /><div className="mx-auto h-2 w-5/6 rounded-full bg-primary/10" /><div className="mx-auto h-2 w-2/3 rounded-full bg-primary/10" /></div>
              {waiting && <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Consultar fonte<ExternalLink className="size-3.5" aria-hidden="true" /></a>}
            </div>}
            <iframe key={`${refresh}-${src}`} src={src} title={`Cotações: ${item.title}`} width="100%" height="460"
              className={`block w-full border-0 ${loaded ? "visible" : "invisible"}`} aria-hidden={!loaded} tabIndex={loaded ? 0 : -1} referrerPolicy="strict-origin-when-cross-origin"
              style={{ colorScheme: "light", backgroundColor: "#FFFFFF", filter: isDark ? "invert(0.92) hue-rotate(180deg)" : undefined }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setWaiting(true); }} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Tabela do Notícias Agrícolas. Confira a data, a unidade e a fonte indicadas dentro da tabela. Role a tabela para ver todas as praças ou vencimentos.</p>
        </> : <div className="flex min-h-36 flex-col justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
          <BarChart3 className="size-7 text-muted-foreground" />
          <p className="text-sm leading-relaxed">Consulte cotações, datas e referências diretamente na página da fonte.</p>
          <p className="text-xs text-muted-foreground">Consulta externa · abre em outra aba.</p>
        </div>}
        <SourceLink href={item.href}>{item.widget ? "Ver fonte e histórico" : "Consultar cotações"}</SourceLink>
        {item.widget && <p className="text-xs text-muted-foreground">Se a tabela não abrir, utilize o botão acima.</p>}
    </div>
  );
};

const MarketCard = ({ item, refresh }: { item: Market; refresh: number }) => {
  const Icon = item.icon;
  return <Card className="min-w-0 overflow-hidden">
    <CardHeader className="space-y-2 pb-4">
      <div className="flex items-center gap-2"><Icon className="size-5 shrink-0 text-primary" /><CardTitle className="text-lg">{item.title}</CardTitle></div>
      <p className="text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p>
    </CardHeader>
    <CardContent><MarketTable item={item} refresh={refresh} /></CardContent>
  </Card>;
};

const BovinesCard = ({ refresh }: { refresh: number }) => <Card className="min-w-0 overflow-hidden">
  <CardHeader className="space-y-2 pb-4">
    <div className="flex items-center gap-2"><Beef className="size-5 shrink-0 text-primary" /><CardTitle className="text-lg">BOVINOS</CardTitle></div>
    <p className="text-xs text-muted-foreground">Mercado físico · selecione a categoria</p>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="boi" className="min-w-0 space-y-3">
      <TabsList aria-label="Categoria de bovinos" className="grid h-auto w-full max-w-md grid-cols-2 gap-1 sm:grid-cols-4">
        {bovines.map(item => <TabsTrigger key={item.key} value={item.key} className="min-h-10 px-2 text-xs">{item.title}</TabsTrigger>)}
      </TabsList>
      {bovines.map(item => <TabsContent key={item.key} value={item.key} className="min-w-0 space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p>
        {item.note && <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">{item.note}</p>}
        <MarketTable item={item} refresh={refresh} />
      </TabsContent>)}
    </Tabs>
  </CardContent>
</Card>;

const MarketPage = () => {
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader titleKey="nav.market" subtitleKey="market.subtitle"
        actions={<Button variant="outline" className="h-10" onClick={() => setRefresh(value => value + 1)}><RefreshCw className="size-4" />Recarregar cotações</Button>} />
      <Tabs defaultValue="physical" className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold"><BarChart3 className="size-4 shrink-0 text-primary" />Acompanhe o mercado</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">Arroba e grãos. Confira a data e a unidade em cada fonte.</p>
          </div>
          <TabsList className="grid h-11 w-full grid-cols-2 md:w-auto md:shrink-0">
            <TabsTrigger value="physical" className="h-9 px-4">Mercado físico</TabsTrigger>
            <TabsTrigger value="futures" className="h-9 px-4">Mercado futuro</TabsTrigger>
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
    </div>
  );
};

export default MarketPage;
