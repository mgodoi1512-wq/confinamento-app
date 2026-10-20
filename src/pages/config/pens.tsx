import { locationName } from "@/lib/location-name";
import { operationalPenStatus, operationalPenLabel, occupancyBadge } from "@/lib/pen-status";
import { locationTypes, locationLabel } from "@/lib/production-systems";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, Plus, Save, Trash2 } from "lucide-react";
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
      render: (row) => <span className="font-display text-sm font-semibold">{locationName(row.pen)}</span>,
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
      headerKey: "field.area",
      numeric: true,
      render: (row) => (row.pen.area_m2 ? formatNumber(row.pen.area_m2, 0) : "—"),
    },
    {
      key: "occupancy",
      headerKey: "field.occupancy",
      render: (row) => (
        <div className="w-32 space-y-1">
          <StatusBadge {...occupancyBadge(row.head,row.capacity)} size="sm"/>
          <OccupancyBar percent={row.percent} overCapacity={row.overCapacity} />
          <p className="text-xs num text-muted-foreground">
            {formatInteger(row.head)} / {formatInteger(row.capacity)}
          </p>
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={(event) => {
              event.stopPropagation();
              openDialog(row.pen);
            }}
          >
            {t("action.edit")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            aria-label={t("action.delete")}
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
    <div className="space-y-5">
      <PageHeader
        titleKey="config.pens.title"
        subtitleKey="config.pens.subtitle"
        actions={
          <Button className="h-10" onClick={() => openDialog()}>
            <Plus />
            {t("pens.new")}
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground">A situação indica se o local está ativo, em manutenção ou inativo. A ocupação é calculada automaticamente pelos animais dos lotes ativos. Locais inativos ou em manutenção não recebem novos lotes.</p>

      <DataTable
        rows={occupancy}
        columns={columns}
        getRowKey={(row) => row.pen.id}
        loading={pensQuery.isLoading}
        emptyState={
          <EmptyState
            icon={Package}
            titleKey="pens.empty.title"
            descriptionKey="pens.empty.description"
            action={
              <Button className="h-10" onClick={() => openDialog()}>
                {t("pens.new")}
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
              {formatInteger(row.head)} / {formatInteger(row.capacity)} cab.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => openDialog(row.pen)}>
                {t("action.edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-destructive"
                onClick={() => void remove(row.pen)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
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
