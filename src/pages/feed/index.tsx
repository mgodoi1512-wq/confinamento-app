import { locationName } from "@/lib/location-name";
import "./feed.css";
import "@/components/app/feed-shift.css";
import { filterFeedHistory } from "@/lib/feed-history";
import { TextField } from "@/components/form/text-field";
import { SelectField } from "@/components/form/select-field";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { FeedSuggestionExport } from "@/components/app/feed-suggestion-export";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Plus, Trash2, UtensilsCrossed, Info, Sunrise, Sun, Moon } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PenFeedingProgress, PenFeedingStatus } from "@/components/app/pen-feeding-status";
import { usePenFeeding } from "@/hooks/use-pen-feeding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteFeedLog, useFeedLogs } from "@/hooks/use-feed";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { computePenOccupancy, summarizeFeedLogs, type FeedLog } from "@/lib/domain";
import { formatDate, formatInteger, formatNumber, todayIso } from "@/lib/format";
import { FeedFormDialog } from "./feed-form-dialog";

const Feed = () => {
  const { t } = useTranslation();
  const today = todayIso();
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [penFilter,setPenFilter]=useState("all");
  const [shiftFilter,setShiftFilter]=useState("all");
  const [page,setPage]=useState(1);
  const [helpOpen,setHelpOpen]=useState(false);
  const [pendingDelete,setPendingDelete]=useState<FeedLog|null>(null);

  const feedQuery = useFeedLogs();
  const pensQuery = usePens();
  const lotsQuery = useLots();
  const feeding = usePenFeeding();
  const deleteFeedLog = useDeleteFeedLog();

  const feedLogs = useMemo(() => feedQuery.data ?? [], [feedQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);

  const history = useMemo(()=>filterFeedHistory(feedLogs,{from,to,pen:penFilter,shift:shiftFilter}),[feedLogs,from,to,penFilter,shiftFilter]);
  const invalidDates=!!from&&!!to&&from>to;
  const pageSize=15,pageCount=Math.max(1,Math.ceil(history.length/pageSize)),currentPage=Math.min(page,pageCount);
  const historyPage=history.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const renderShift=(log:FeedLog)=>{const Icon=log.shift==="noite"?Moon:log.shift==="tarde"?Sun:Sunrise;return <span className={`feed-shift ${log.shift==="manha"?"is-morning":log.shift==="tarde"?"is-afternoon":"is-night"}`}><Icon className="size-4" aria-hidden="true"/>{t(`feed.shift.${log.shift}`)}</span>;};
  const occupancy = useMemo(() => computePenOccupancy(pens, lots), [pens, lots]);
  const pensWithLot = occupancy.filter((item) => item.lot);

  const todayLogs = feedLogs.filter((log) => log.date === today);
  const todayRows = pensWithLot.map(item => {
    const logs = todayLogs.filter(log => log.pen_id === item.pen.id);
    const summary = summarizeFeedLogs(logs);
    return {
      id: item.pen.id,
      penCode: locationName(item.pen),
      lotCode: lots.filter(lot=>lot.status==="ativo" && lot.pen_id===item.pen.id).map(lot=>lot.code).join(", ") || "—",
      feeding: feeding.forPen(item.pen.id),
      hasFeed: logs.length > 0,
      total: summary.totalKg,
      perHead: summary.averageKgPerHeadPerLog,
    };
  });
  const todayLoading = [pensQuery, lotsQuery, feedQuery].some(query => query.isLoading);
  const columns: Column<FeedLog>[] = [
    { key: "date", headerKey: "field.date", render: (log) => formatDate(log.date) },
    {
      key: "pen",
      headerKey: "feed.pen",
      render: (log) => (
        <span className="font-display text-sm font-semibold">
          {locationName(pens.find((pen) => pen.id === log.pen_id), "—")}
        </span>
      ),
    },
    { key: "shift", headerKey: "feed.shift", render: renderShift },
    {
      key: "head",
      headerKey: "field.headCount",
      numeric: true,
      render: (log) => formatInteger(log.head_count),
    },
    {
      key: "perHead",
      headerKey: "Fornecido por animal",
      numeric: true,
      render: (log) => `${formatNumber(log.kg_per_head, 2)} kg`,
    },
    {
      key: "total",
      headerKey: "feed.total",
      numeric: true,
      render: (log) => `${formatNumber(log.total_kg, 2)} kg`,
    },
  ];

  const remove = async () => {
    if(!pendingDelete||deleteFeedLog.isPending)return;
    try {
      await deleteFeedLog.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      toast.success(t("toast.saved"));
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <div className="feed-page space-y-5">
      <PageHeader
        titleKey="feed.title"
        subtitleKey="feed.subtitle"
        actions={
          <>
            <FeedSuggestionExport />
            <Button asChild variant="outline" className="h-10">
              <Link to="/trato/leitura">
                <ClipboardCheck />
                {t("nav.reading")}
              </Link>
            </Button>
            <FeedFormDialog
              trigger={
                <Button className="h-10">
                  <Plus />
                  {t("feed.new")}
                </Button>
              }
            />
          </>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3"><CardTitle className="font-display text-lg">{t("feed.today")}</CardTitle><Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" aria-expanded={helpOpen} aria-controls="feed-today-help" onClick={()=>setHelpOpen(!helpOpen)}><Info className="size-4"/>Como funciona</Button></div>
            <span className="text-sm num text-muted-foreground">
              {todayLoading ? "—" : t("feed.todayProgress", {
                done: todayRows.filter(row => row.feeding?.shifts.every(shift => shift.complete || shift.total === 0)).length,
                total: pensWithLot.length,
              })}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <p id="feed-today-help" hidden={!helpOpen} className="mb-3 text-xs leading-relaxed text-muted-foreground">Tratos de hoje: verde = fornecido para todos os lotes; vermelho = pendente ou parcial. A barra compara a mistura fornecida (ração + volumoso) com a recomendação diária da dieta, pelo planejamento fixado no primeiro trato; antes disso, pela referência atual do lote. A média é por lançamento; os registros representam oferta, não ingestão medida.</p>
          <div className="overflow-x-auto"><div className="md:min-w-[900px]">
          <DataTable
            rows={todayRows}
            columns={[
              {
                key: "pen", headerKey: "feed.pen", 
                render: row => <span className="font-display font-semibold">{row.penCode}</span>,
              },
              { key: "lot", headerKey: "field.lot",  render: row => row.lotCode },
              {
                key: "status", headerKey: "field.status", className: "text-center",
                render: row => <div className="flex justify-center"><PenFeedingStatus summary={row.feeding} error={feeding.error} /></div>,
              },
              {
                key: "dailyProgress", headerKey: "Fornecimento da dieta", className: "text-center",
                render: row => <div className="flex justify-center"><PenFeedingProgress summary={row.feeding} error={feeding.error} /></div>,
              },
              {
                key: "perHead", headerKey: "Oferta média por lançamento", numeric: true, className: "text-center",
                render: row => row.perHead !== null ? `${formatNumber(row.perHead, 2)} kg/cab` : "—",
              },
              {
                key: "recommended", headerKey: "Total recomendado", numeric: true, className: "text-center",
                render: row => row.feeding?.recommendedKg != null ? `${formatNumber(row.feeding.recommendedKg,2)} kg` : "—",
              },
              {
                key: "total", headerKey: "feed.total", numeric: true, className: "text-center",
                render: row => row.hasFeed ? `${formatNumber(row.total, 2)} kg` : "—",
              },
            ]}
            getRowKey={row => row.id}
            loading={todayLoading}
            emptyState={
              <EmptyState icon={UtensilsCrossed} titleKey="feed.empty.title" descriptionKey="feed.empty.description" />
            }
            renderCard={row => (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-display text-base font-semibold">{row.penCode}</p>
                    <p className="break-words text-xs text-muted-foreground">{t("field.lot")}: {row.lotCode}</p>
                  </div>
                  <PenFeedingStatus summary={row.feeding} error={feeding.error} />
                </div>
                <div className="border-t pt-3"><PenFeedingProgress summary={row.feeding} error={feeding.error} /></div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Oferta média por lançamento</p>
                    <p className="num font-medium">{row.perHead !== null ? `${formatNumber(row.perHead, 2)} kg/cab` : "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total recomendado</p>
                    <p className="num font-medium">{row.feeding?.recommendedKg != null ? `${formatNumber(row.feeding.recommendedKg,2)} kg` : "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t("feed.total")}</p>
                    <p className="num font-medium">{row.hasFeed ? `${formatNumber(row.total, 2)} kg` : "—"}</p>
                  </div>
                </div>
              </div>
            )}
          />
          </div></div>
        </CardContent>
      </Card>

      <Card className="feed-history"><CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="font-display text-lg">Histórico de fornecimento</CardTitle><span className="text-sm text-muted-foreground" aria-live="polite">{feedQuery.isLoading||feedQuery.isError?"—":`${history.length} registro(s)`}</span></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="De" type="date" value={from} onChange={value=>{setFrom(value);setPage(1);}}/>
          <TextField label="Até" type="date" value={to} onChange={value=>{setTo(value);setPage(1);}}/>
          <SelectField label="Local" value={penFilter} onChange={value=>{setPenFilter(value);setPage(1);}} options={[{value:"all",labelKey:"Todos os locais"},...pens.slice().sort((a,b)=>a.code.localeCompare(b.code,"pt-BR",{numeric:true})).map(pen=>({value:pen.id,labelKey:locationName(pen)}))]}/>
          <SelectField label="Turno" value={shiftFilter} onChange={value=>{setShiftFilter(value);setPage(1);}} options={[{value:"all",labelKey:"Todos os turnos"},...(["manha","tarde","noite"] as const).map(shift=>({value:shift,labelKey:`feed.shift.${shift}`}))]}/>
        </div>
        {invalidDates&&<p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior ou igual à data final.</p>}
        {feedQuery.isError?<div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">Não foi possível carregar o histórico.<Button variant="outline" size="sm" onClick={()=>void feedQuery.refetch()}>Tentar novamente</Button></div>:<DataTable
          rows={historyPage}
          columns={[
            ...columns,
            {key:"actions",headerKey:"common.actions",render:(log:FeedLog)=><Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={`Excluir trato de ${locationName(pens.find(pen=>pen.id===log.pen_id), "local")}, ${formatDate(log.date)}, ${t(`feed.shift.${log.shift}`)}`} disabled={deleteFeedLog.isPending} onClick={()=>setPendingDelete(log)}><Trash2 className="size-4"/></Button>},
          ].map(column=>({...column,className:"text-center"}))}
          getRowKey={log=>log.id}
          loading={feedQuery.isLoading}
          emptyState={<EmptyState icon={UtensilsCrossed} titleKey="Nenhum registro para os filtros selecionados" descriptionKey="Ajuste o período, o local ou o turno para consultar outros fornecimentos."/>}
          renderCard={log=><div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="font-display text-base">{locationName(pens.find(pen=>pen.id===log.pen_id), "—")}</strong><span className="text-xs text-muted-foreground">{formatDate(log.date)}</span></div><div className="flex flex-wrap items-center justify-between gap-2 text-sm">{renderShift(log)}<span>{formatInteger(log.head_count)} animais</span></div><div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm"><span>{formatNumber(log.kg_per_head,2)} kg/animal</span><strong>{formatNumber(log.total_kg,2)} kg</strong><Button variant="ghost" size="icon" className="size-10 text-muted-foreground" aria-label="Excluir trato" disabled={deleteFeedLog.isPending} onClick={()=>setPendingDelete(log)}><Trash2 className="size-4"/></Button></div></div>}
        />}
        {!feedQuery.isLoading&&!feedQuery.isError&&<nav aria-label="Paginação do histórico de tratos" className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground" aria-live="polite">{history.length?`Mostrando ${(currentPage-1)*pageSize+1} a ${Math.min(currentPage*pageSize,history.length)} de ${history.length}`:"0 registros"} · 15 por página</p><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" className="min-h-10" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</Button><span className="text-xs">Página {currentPage} de {pageCount}</span><Button type="button" variant="outline" size="sm" className="min-h-10" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>Próxima</Button></div></nav>}
      </CardContent></Card>
      <AlertDialog open={!!pendingDelete} onOpenChange={open=>{if(!open&&!deleteFeedLog.isPending)setPendingDelete(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir registro de trato?</AlertDialogTitle><AlertDialogDescription>{pendingDelete&&`${formatDate(pendingDelete.date)} · ${locationName(pens.find(pen=>pen.id===pendingDelete.pen_id), "Local")} · ${t(`feed.shift.${pendingDelete.shift}`)} · ${formatNumber(pendingDelete.total_kg,2)} kg. `}Confirme para remover este fornecimento do histórico e dos totais.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteFeedLog.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteFeedLog.isPending} onClick={event=>{event.preventDefault();void remove();}}>{deleteFeedLog.isPending?"Excluindo…":"Excluir registro"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
};

export default Feed;
