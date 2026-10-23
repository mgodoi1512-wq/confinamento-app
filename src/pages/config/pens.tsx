import { locationName } from "@/lib/location-name";
import { operationalPenStatus, operationalPenLabel, occupancyBadge } from "@/lib/pen-status";
import { locationTypes, locationLabel } from "@/lib/production-systems";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Package, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { NumericField } from "@/components/app/numeric-field";
import { OccupancyBar } from "@/components/app/occupancy-bar";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useLots } from "@/hooks/use-lots";
import { useDeletePen, usePens, useSavePen } from "@/hooks/use-pens";
import { PEN_STATUS_OPTIONS } from "@/lib/constants";
import { computePenOccupancy, penStatusTone, type Pen } from "@/lib/domain";
import { formatInteger, formatNumber, parseNumberInput } from "@/lib/format";

const fold=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const SettingsPens = () => {
  const { t } = useTranslation();
  const { isGestor } = useAuth();

  const pensQuery = usePens();
  const lotsQuery = useLots();
  const savePen = useSavePen();
  const deletePen = useDeletePen();

  const pens = pensQuery.data ?? [];
  const lots = lotsQuery.data ?? [];
  const occupancy = computePenOccupancy(pens, lots);

  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [page,setPage]=useState(1);
  const filtered=occupancy.filter(row=>(typeFilter==="all"||(row.pen.location_type??"curral")===typeFilter)&&(statusFilter==="all"||operationalPenStatus(row.pen.status)===statusFilter)&&fold(`${row.pen.code} ${locationName(row.pen)}`).includes(fold(search.trim()))).sort((a,b)=>locationName(a.pen).localeCompare(locationName(b.pen),"pt-BR",{numeric:true,sensitivity:"base"}));
  const pageCount=Math.max(1,Math.ceil(filtered.length/15));
  const currentPage=Math.min(page,pageCount);
  const visible=filtered.slice((currentPage-1)*15,currentPage*15);
  const clearFilters=()=>{setSearch("");setTypeFilter("all");setStatusFilter("all");setPage(1);};
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pen | null>(null);
  const [locationType,setLocationType]=useState("curral");
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("ativo");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openDialog = (pen?: Pen) => {
    setEditing(pen ?? null);
    setLocationType(pen?.location_type??"curral");
    setCode(pen?.code ?? "");
    setCapacity(pen ? String(pen.capacity_head) : "");
    setArea(pen?.area_m2 ? String(pen.area_m2) : "");
    setStatus(operationalPenStatus(pen?.status ?? "ativo"));
    setNotes(pen?.notes ?? "");
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!code.trim() || !parseNumberInput(capacity)) {
      setError(t("toast.requiredFields"));
      return;
    }

    try {
      await savePen.mutateAsync({
        id: editing?.id,
        code: code.trim(),
        location_type: locationType,
        capacity_head: parseNumberInput(capacity) ?? 0,
        area_m2: parseNumberInput(area),
        status,
        notes: notes.trim() || null,
      });
      toast.success(t("pens.saved"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  const remove = async (pen: Pen) => {
    try {
      await deletePen.mutateAsync(pen.id);
      toast.success(t("pens.deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  const columns: Column<(typeof occupancy)[number]>[] = [
    {
      key: "code",
      headerKey: "field.code",
      render: (row) => <span className="font-sans text-sm font-semibold">{locationName(row.pen)}</span>,
    },
    {key:"location_type",headerKey:"Tipo de local",render:row=>locationLabel(row.pen.location_type)},
    {
      key: "status",
      headerKey: "Situação do local",
      render: (row) => (
        <StatusBadge
          tone={penStatusTone(operationalPenStatus(row.pen.status))}
          label={operationalPenLabel(row.pen.status)}
          size="sm"
        />
      ),
    },
    {
      key: "capacity",
      headerKey: "field.capacity",
      numeric: true,
      render: (row) => formatInteger(row.capacity),
    },
    {
      key: "area",
      headerKey: "Área (m²)",
      numeric: true,
      render: (row) => (row.pen.area_m2 ? formatNumber(row.pen.area_m2, 0) : "—"),
    },
    {
      key: "occupancy",
      headerKey: "field.occupancy",
      render: (row) => (
        <div className="mx-auto w-40 space-y-1">
          <StatusBadge {...occupancyBadge(row.head,row.capacity)} size="sm" className={row.head<=0?"!bg-zinc-100 !text-zinc-600 dark:!bg-zinc-800 dark:!text-zinc-300":undefined}/>
          <div className="flex items-center gap-2"><OccupancyBar className="min-w-0 flex-1" percent={row.percent} overCapacity={row.overCapacity} />
          <p className="shrink-0 whitespace-nowrap text-xs num text-muted-foreground">
            {formatInteger(row.head)} / {formatInteger(row.capacity)}
          </p></div>
        </div>
      ),
    },
    {
      key: "notes",
      headerKey: "field.notes",
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.pen.notes ?? "—"}</span>
      ),
    },
    {
      key: "actions",
      headerKey: "common.actions",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`Editar ${locationName(row.pen)}`}
            title={`Editar ${locationName(row.pen)}`}
            onClick={(event) => {
              event.stopPropagation();
              openDialog(row.pen);
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-destructive"
            aria-label={`Excluir ${locationName(row.pen)}`}
            title={`Excluir ${locationName(row.pen)}`}
            onClick={(event) => {
              event.stopPropagation();
              void remove(row.pen);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  if (!isGestor) {
    return (
      <EmptyState
        icon={Package}
        titleKey="empty.permission.title"
        descriptionKey="empty.permission.description"
      />
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-20">
      <PageHeader
        titleKey="config.pens.title"
        subtitleKey="config.pens.subtitle"
        actions={
          <Button className="h-10 w-40 shrink-0" onClick={() => openDialog()}>
            <Plus />
            {t("pens.new")}
          </Button>
        }
      />

      <details className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"><summary className="w-fit cursor-pointer rounded-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Como funciona</summary><p className="mt-2 leading-relaxed">A situação indica se o local está ativo, em manutenção ou inativo. A ocupação é calculada automaticamente pelos animais dos lotes ativos. Locais inativos ou em manutenção não recebem novos lotes.</p></details>

      <section className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_14rem_14rem]">
        <TextField label="Buscar local" placeholder="Nome ou código" value={search} onChange={value=>{setSearch(value);setPage(1);}}/>
        <SelectField label="Tipo de local" value={typeFilter} onChange={value=>{setTypeFilter(value);setPage(1);}} options={[{value:"all",labelKey:"Todos os tipos"},...locationTypes]}/>
        <SelectField label="Situação do local" value={statusFilter} onChange={value=>{setStatusFilter(value);setPage(1);}} options={[{value:"all",labelKey:"Todas as situações"},...PEN_STATUS_OPTIONS]}/>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">Exibir locais · {filtered.length} {filtered.length===1?"resultado":"resultados"}</p>
      {(pensQuery.isError||lotsQuery.isError)&&<div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">Não foi possível carregar os locais ou sua ocupação. <Button variant="outline" size="sm" onClick={()=>{void pensQuery.refetch();void lotsQuery.refetch();}}>Tentar novamente</Button></div>}
      <DataTable
        className="min-w-0 [&>div:first-child]:overflow-x-auto [&_table]:min-w-[850px] [&_td]:py-1.5 [&_th]:py-2"
        rows={pensQuery.isError||lotsQuery.isError?[]:visible}
        columns={columns.map(column=>({...column,className:"text-center"}))}
        getRowKey={(row) => row.pen.id}
        loading={pensQuery.isLoading||lotsQuery.isLoading}
        emptyState={pensQuery.isError||lotsQuery.isError?null:
          <EmptyState
            icon={Package}
            titleKey={pens.length?"Nenhum local encontrado":"pens.empty.title"}
            descriptionKey={pens.length?"Revise a busca ou os filtros para encontrar o local.":"pens.empty.description"}
            action={
              <Button className="h-10 w-40 shrink-0" onClick={pens.length?clearFilters:() => openDialog()}>
                {pens.length?"Limpar filtros":t("pens.new")}
              </Button>
            }
          />
        }
        renderCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-base font-semibold">{locationName(row.pen)}</span>
              <StatusBadge
                tone={penStatusTone(operationalPenStatus(row.pen.status))}
                label={operationalPenLabel(row.pen.status)}
                size="sm"
              />
            </div>
            <p className="text-sm num text-muted-foreground">
              {locationLabel(row.pen.location_type)} · {row.pen.area_m2!=null?`${formatNumber(row.pen.area_m2,0)} m²`:"Área não informada"}
            </p>
            {columns.find(column=>column.key==="occupancy")?.render(row)}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => openDialog(row.pen)}>
                {t("action.edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-destructive"
                aria-label={`Excluir ${locationName(row.pen)}`}
                onClick={() => void remove(row.pen)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        )}
      />

      {!pensQuery.isLoading&&!lotsQuery.isLoading&&!pensQuery.isError&&!lotsQuery.isError&&filtered.length>0&&<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span>{(currentPage-1)*15+1}–{Math.min(currentPage*15,filtered.length)} de {filtered.length} · Página {currentPage} de {pageCount}</span>
        <nav aria-label="Paginação dos locais" className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}><ChevronLeft className="size-4"/>Anterior</Button><Button variant="outline" size="sm" disabled={currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Próxima<ChevronRight className="size-4"/></Button></nav>
      </div>}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("pens.edit") : t("pens.new")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Tipo de local" value={locationType} onChange={setLocationType} options={locationTypes}/>
            <TextField
              label={t("field.code")}
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              error={error ?? undefined}
              required
            />
            <SelectField
              label="Situação do local"
              value={status}
              onChange={setStatus}
              options={PEN_STATUS_OPTIONS}
            />
            <NumericField
              label={t("field.capacity")}
              unit="cab."
              inputMode="numeric"
              value={capacity}
              onValueChange={setCapacity}
            />
            <NumericField
              label={t("field.area")}
              unit="m²"
              value={area}
              onValueChange={setArea}
            />
            <TextField
              className="sm:col-span-2"
              label={t("field.notes")}
              value={notes}
              onChange={setNotes}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={savePen.isPending}>
              <Save />
              {t("action.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPens;
