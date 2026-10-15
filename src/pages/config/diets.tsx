import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteDiet, useDietItems, useDiets, useSaveDiet } from "@/hooks/use-diets";
import { INGREDIENT_SUGGESTIONS } from "@/lib/constants";
import { normalizeDietName, type Diet } from "@/lib/domain";
import { formatNumber, parseNumberInput } from "@/lib/format";

type ItemDraft = { key: string; ingredient: string; kg: string; unit: "kg" | "percent_bw" };

const emptyItem = (): ItemDraft => ({ key: crypto.randomUUID(), ingredient: "", kg: "", unit: "percent_bw" });

const quantitySummary = (items: { kg_per_head_day: number; body_weight_pct?: number | null }[]) => {
  const percentages = items.filter(item => item.body_weight_pct != null);
  const fixed = items.filter(item => item.body_weight_pct == null);
  const parts: string[] = [];
  if (percentages.length) parts.push(`${formatNumber(percentages.reduce((sum, item) => sum + (item.body_weight_pct ?? 0), 0), 4)}% PV`);
  if (fixed.length) parts.push(`${formatNumber(fixed.reduce((sum, item) => sum + item.kg_per_head_day, 0), 3)} kg/cab/dia`);
  return parts.join(" + ") || "0% PV";
};

const SettingsDiets = () => {
  const { t } = useTranslation();
  const { isGestor } = useAuth();

  const dietsQuery = useDiets();
  const itemsQuery = useDietItems();
  const saveDiet = useSaveDiet();
  const deleteDiet = useDeleteDiet();

  const diets = useMemo(() => dietsQuery.data ?? [], [dietsQuery.data]);
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Diet | null>(null);
  const [name, setName] = useState("");
  const [dryMatter, setDryMatter] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [drafts, setDrafts] = useState<ItemDraft[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(
    () =>
      diets.map((diet) => ({
        diet,
        items: items.filter((item) => item.diet_id === diet.id),
      })),
    [diets, items],
  );

  const openDialog = (diet?: Diet) => {
    setEditing(diet ?? null);
    setName(diet?.name ?? "");
    setDryMatter(diet?.dry_matter_pct ? String(diet.dry_matter_pct) : "");
    setNotes(diet?.notes ?? "");
    setIsActive(diet?.is_active ?? true);
    setDrafts(
      diet
        ? items
            .filter((item) => item.diet_id === diet.id)
            .map((item) => ({
              key: item.id,
              ingredient: item.ingredient,
              kg: String(item.body_weight_pct ?? item.kg_per_head_day),
              unit: item.body_weight_pct != null ? "percent_bw" : "kg",
            }))
        : [emptyItem()],
    );
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError(t("toast.requiredFields"));
      return;
    }

    if (diets.some(diet => diet.id !== editing?.id && normalizeDietName(diet.name) === normalizeDietName(name))) {
      setError("Já existe uma dieta com esse nome, ativa ou inativa. Use outro nome ou edite a dieta existente.");
      return;
    }
    const filled = drafts.filter(draft => draft.ingredient.trim() || draft.kg.trim());
    if (!filled.length || filled.some(draft => !draft.ingredient.trim() || parseNumberInput(draft.kg) === null || (parseNumberInput(draft.kg) ?? -1) < 0 || (draft.unit === "percent_bw" && (parseNumberInput(draft.kg) ?? 101) > 100))) {
      setError("Preencha os ingredientes e quantidades. O percentual do peso vivo deve estar entre 0 e 100.");
      return;
    }
    try {
      await saveDiet.mutateAsync({
        diet: {
          id: editing?.id,
          name: name.trim().replace(/\s+/g, " "),
          dry_matter_pct: parseNumberInput(dryMatter),
          notes: notes.trim() || null,
          is_active: isActive,
        },
        items: filled.map((draft) => ({
          ingredient: draft.ingredient.trim(),
          kg_per_head_day: draft.unit === "kg" ? parseNumberInput(draft.kg) ?? 0 : 0,
          body_weight_pct: draft.unit === "percent_bw" ? parseNumberInput(draft.kg) : null,
        })),
      });
      toast.success(t("config.diets.saved"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  const remove = async (diet: Diet) => {
    try {
      await deleteDiet.mutateAsync(diet.id);
      toast.success(t("config.diets.deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  if (!isGestor) {
    return (
      <EmptyState
        icon={BarChart3}
        titleKey="empty.permission.title"
        descriptionKey="empty.permission.description"
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="config.diets.title"
        subtitleKey="config.diets.subtitle"
        actions={
          <Button className="h-10" onClick={() => openDialog()}>
            <Plus />
            {t("config.diets.new")}
          </Button>
        }
      />

      {grouped.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          titleKey="config.diets.empty.title"
          descriptionKey="config.diets.empty.description"
          action={
            <Button className="h-10" onClick={() => openDialog()}>
              {t("config.diets.new")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grouped.map(({ diet, items: dietItems }) => (
            <Card key={diet.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="font-display text-lg">{diet.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("config.diets.totalOffered")}:{" "}
                      <span className="num font-medium">
                        {quantitySummary(dietItems)}
                      </span>
                      {diet.dry_matter_pct
                        ? ` · ${t("field.dryMatter")} ${formatNumber(diet.dry_matter_pct, 1)}%`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge
                    tone={diet.is_active ? "success" : "muted"}
                    label={diet.is_active ? t("config.diets.active") : t("config.diets.inactive")}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {dietItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{item.ingredient}</span>
                      <span className="num shrink-0 text-muted-foreground">
                        {item.body_weight_pct != null
                          ? `${formatNumber(item.body_weight_pct, 4)}% PV`
                          : `${formatNumber(item.kg_per_head_day, 3)} kg`}
                      </span>
                    </li>
                  ))}
                  {dietItems.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">{t("common.noData")}</li>
                  ) : null}
                </ul>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 flex-1"
                    onClick={() => openDialog(diet)}
                  >
                    {t("action.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 text-destructive"
                    onClick={() => void remove(diet)}
                  >
                    <Trash2 />
                    {t("action.delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("config.diets.edit") : t("config.diets.new")}</DialogTitle>
          </DialogHeader>

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <TextField
              className="[&_input]:h-12 [&_label]:text-xs [&_label]:text-muted-foreground"
              label={t("field.name")}
              value={name}
              onChange={(value) => {
                setName(value);
                setError(null);
              }}
              error={error ?? undefined}
              required
            />
            <NumericField
              label={t("field.dryMatter")}
              unit="%"
              value={dryMatter}
              onValueChange={setDryMatter}
            />
            <TextField
              className="sm:col-span-2"
              label={t("field.notes")}
              value={notes}
              onChange={setNotes}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            {t("config.diets.active")}
          </label>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Informe o percentual do peso vivo ou os kg fixos de cada ingrediente. A conversão para kg será feita no trato, pelo peso médio do lote.</p>
            {drafts.map((draft) => (
              <div key={draft.key} className="flex flex-wrap items-start gap-3">
                <TextField
                  className="min-w-0 basis-full sm:basis-0 sm:flex-1 [&_input]:h-12 [&_label]:text-xs [&_label]:text-muted-foreground"
                  label={t("field.ingredient")}
                  value={draft.ingredient}
                  onChange={(value) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.key === draft.key ? { ...item, ingredient: value } : item,
                      ),
                    )
                  }
                />
                <div className="w-28 shrink-0 sm:w-32">
                  <SelectField className="[&_label]:text-xs [&_label]:text-muted-foreground" triggerClassName="h-12" label="Unidade" value={draft.unit} onChange={value => setDrafts(current => current.map(item => item.key === draft.key ? { ...item, unit: value as ItemDraft["unit"], kg: "" } : item))}
                    options={[{ value: "percent_bw", labelKey: "% peso vivo" }, { value: "kg", labelKey: "kg/cab/dia" }]} />
                </div>
                <NumericField
                  className="w-28 shrink-0 sm:w-32"
                  label={t("field.inclusion")}
                  unit={draft.unit === "percent_bw" ? "% PV" : "kg"}
                  value={draft.kg}
                  onValueChange={(value) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.key === draft.key ? { ...item, kg: value } : item,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-[22px] h-12 w-11 shrink-0 text-muted-foreground"
                  aria-label={t("action.delete")}
                  onClick={() =>
                    setDrafts((current) => current.filter((item) => item.key !== draft.key))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}

            <p className="text-xs text-muted-foreground">
              {INGREDIENT_SUGGESTIONS.slice(0, 4).join(" · ")}
            </p>

            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => setDrafts((current) => [...current, emptyItem()])}
            >
              <Plus />
              {t("field.ingredient")}
            </Button>

            <p className="text-right text-sm text-muted-foreground">
              {t("config.diets.totalOffered")}:{" "}
              <span className="num font-medium text-foreground">
                {quantitySummary(drafts.filter(draft => draft.kg.trim()).map(draft => ({
                  kg_per_head_day: draft.unit === "kg" ? parseNumberInput(draft.kg) ?? 0 : 0,
                  body_weight_pct: draft.unit === "percent_bw" ? parseNumberInput(draft.kg) ?? 0 : null,
                })))}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saveDiet.isPending}>
              <Save />
              {t("action.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsDiets;
