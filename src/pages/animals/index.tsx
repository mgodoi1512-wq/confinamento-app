import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Plus, Search } from "lucide-react";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnimals } from "@/hooks/use-animals";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { SELECT_ALL } from "@/lib/constants";
import {
  animalGain,
  animalStatusTone,
  healthTone,
  isUnderWithdrawal,
  liveWeightToArroba,
  type Animal,
} from "@/lib/domain";
import { formatNumber, todayIso } from "@/lib/format";
import { AnimalDetailSheet } from "./animal-detail-sheet";
import { AnimalFormDialog } from "./animal-form-dialog";

const HEALTH_FILTER_OPTIONS = [
  { value: "saudavel", labelKey: "status.health.saudavel" },
  { value: "tratamento", labelKey: "status.health.tratamento" },
  { value: "observacao", labelKey: "status.health.observacao" },
  { value: "carencia", labelKey: "status.health.carencia" },
];

const Animals = () => {
  const { t } = useTranslation();
  const today = todayIso();

  const animalsQuery = useAnimals();
  const pensQuery = usePens();
  const lotsQuery = useLots();

  const [search, setSearch] = useState("");
  const [penFilter, setPenFilter] = useState(SELECT_ALL);
  const [lotFilter, setLotFilter] = useState(SELECT_ALL);
  const [healthFilter, setHealthFilter] = useState(SELECT_ALL);
  const [selected, setSelected] = useState<Animal | null>(null);

  const pens = pensQuery.data ?? [];
  const lots = lotsQuery.data ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (animalsQuery.data ?? []).filter((animal) => {
      if (term && !`${animal.ear_tag} ${animal.sisbov ?? ""}`.toLowerCase().includes(term)) {
        return false;
      }
      if (penFilter !== SELECT_ALL && animal.pen_id !== penFilter) return false;
      if (lotFilter !== SELECT_ALL && animal.lot_id !== lotFilter) return false;
      if (healthFilter === "carencia" && !isUnderWithdrawal(animal, today)) return false;
      if (
        healthFilter !== SELECT_ALL &&
        healthFilter !== "carencia" &&
        animal.health_status !== healthFilter
      ) {
        return false;
      }
      return true;
    });
  }, [animalsQuery.data, search, penFilter, lotFilter, healthFilter, today]);

  const columns: Column<Animal>[] = [
    {
      key: "tag",
      headerKey: "field.earTag",
      render: (row) => <span className="font-display text-sm font-semibold">{row.ear_tag}</span>,
    },
    { key: "sisbov", headerKey: "field.sisbov", render: (row) => row.sisbov ?? "—" },
    {
      key: "lot",
      headerKey: "field.lot",
      render: (row) => lots.find((lot) => lot.id === row.lot_id)?.code ?? "—",
    },
    {
      key: "pen",
      headerKey: "field.pen",
      render: (row) => pens.find((pen) => pen.id === row.pen_id)?.code ?? "—",
    },
    {
      key: "current",
      headerKey: "field.currentWeight",
      numeric: true,
      render: (row) =>
        row.current_weight_kg ? `${formatNumber(row.current_weight_kg, 1)} kg` : "—",
    },
    {
      key: "gain",
      headerKey: "animals.detail.gain",
      numeric: true,
      render: (row) => {
        const gain = animalGain(row);
        return gain !== null ? `${formatNumber(gain, 1)} kg` : "—";
      },
    },
    {
      key: "arroba",
      headerKey: "field.arroba",
      numeric: true,
      render: (row) => {
        const arroba = liveWeightToArroba(row.current_weight_kg);
        return arroba !== null ? formatNumber(arroba, 1) : "—";
      },
    },
    {
      key: "status",
      headerKey: "field.status",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            tone={animalStatusTone(row.status)}
            label={t(`status.animal.${row.status}`)}
            size="sm"
          />
          <StatusBadge
            tone={healthTone(row.health_status)}
            label={t(`status.health.${row.health_status}`)}
            size="sm"
          />
          {isUnderWithdrawal(row, today) ? (
            <StatusBadge tone="agro" label={t("status.health.carencia")} size="sm" />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="animals.title"
        subtitleKey="animals.subtitle"
        actions={
          <AnimalFormDialog
            trigger={
              <Button className="h-10">
                <Plus />
                {t("animals.new")}
              </Button>
            }
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("animals.searchPlaceholder")}
            className="h-11 pl-9"
          />
        </div>
        <SelectField
          value={penFilter}
          onChange={setPenFilter}
          allowEmpty
          emptyLabel={t("common.allPens")}
          options={pens.map((pen) => ({ value: pen.id, labelKey: pen.code }))}
        />
        <SelectField
          value={lotFilter}
          onChange={setLotFilter}
          allowEmpty
          emptyLabel={t("common.allLots")}
          options={lots.map((lot) => ({ value: lot.id, labelKey: lot.code }))}
        />
        <SelectField
          value={healthFilter}
          onChange={setHealthFilter}
          allowEmpty
          emptyLabel={t("field.healthStatus")}
          options={HEALTH_FILTER_OPTIONS}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {rows.length} {t("common.results")}
      </p>

      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.id}
        onRowClick={(row) => setSelected(row)}
        loading={animalsQuery.isLoading}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            titleKey={animalsQuery.data?.length ? "animals.emptyFilers" : "animals.empty.title"}
            descriptionKey={
              animalsQuery.data?.length ? undefined : "animals.empty.description"
            }
            action={
              animalsQuery.data?.length ? (
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => {
                    setSearch("");
                    setPenFilter(SELECT_ALL);
                    setLotFilter(SELECT_ALL);
                    setHealthFilter(SELECT_ALL);
                  }}
                >
                  {t("action.clear")}
                </Button>
              ) : (
                <AnimalFormDialog
                  trigger={
                    <Button className="h-10">
                      <Plus />
                      {t("animals.new")}
                    </Button>
                  }
                />
              )
            }
          />
        }
        renderCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">{row.ear_tag}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {lots.find((lot) => lot.id === row.lot_id)?.code ?? "—"} ·{" "}
                  {pens.find((pen) => pen.id === row.pen_id)?.code ?? "—"}
                </p>
              </div>
              <StatusBadge
                tone={healthTone(row.health_status)}
                label={t(`status.health.${row.health_status}`)}
                size="sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("field.currentWeight")}</p>
                <p className="num font-medium">
                  {row.current_weight_kg ? `${formatNumber(row.current_weight_kg, 1)} kg` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("animals.detail.gain")}</p>
                <p className="num font-medium">
                  {animalGain(row) !== null ? `${formatNumber(animalGain(row) ?? 0, 1)} kg` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.arroba")}</p>
                <p className="num font-medium">
                  {liveWeightToArroba(row.current_weight_kg) !== null
                    ? formatNumber(liveWeightToArroba(row.current_weight_kg) ?? 0, 1)
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      />

      <AnimalDetailSheet animal={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default Animals;
