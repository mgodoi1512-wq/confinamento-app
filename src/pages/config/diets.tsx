import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
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
import { dietTotalKg, type Diet } from "@/lib/domain";
import { formatNumber, parseNumberInput } from "@/lib/format";

type ItemDraft = { key: string; ingredient: string; kg: string };

const emptyItem = (): ItemDraft => ({ key: crypto.randomUUID(), ingredient: "", kg: "" });

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
              kg: String(item.kg_per_head_day),
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

    try {
      await saveDiet.mutateAsync({
        diet: {
          id: editing?.id,
          name: name.trim(),
          dry_matter_pct: parseNumberInput(dryMatter),
          notes: notes.trim() || null,
          is_active: isActive,
        },
        items: drafts.map((draft) => ({
          ingredient: draft.ingredient.trim(),
          kg_per_head_day: parseNumberInput(draft.kg) ?? 0,
        })),
      });
      toast.success(t("config.diets.saved"));
      setOpen(false);
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  const remove = async (diet: Diet) => {
    try {
      await deleteDiet.mutateAsync(diet.id);
      toast.success(t("config.diets.deleted"));
    } catch {
      toast.error(t("toast.error.generic"));
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
                        {formatNumber(dietTotalKg(dietItems), 2)} kg/cab/dia
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
                        {formatNumber(item.kg_per_head_day, 3)} kg
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

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
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
            <p className="text-sm font-medium">{t("field.ingredient")}</p>
            {drafts.map((draft) => (
              <div key={draft.key} className="flex items-end gap-3">
                <TextField
                  className="flex-1"
                  label={t("field.ingredient")}
                  value={draft.ingredient}
                  onChange={(value) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.key === draft.key ? { ...item, ingredient: value } : item,
                      ),
                    )
                  }
                  helper={INGREDIENT_SUGGESTIONS.slice(0, 4).join(" · ")}
                />
                <NumericField
                  className="w-36"
                  label={t("field.inclusion")}
                  unit="kg"
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
                  className="mb-1 h-11 w-11 text-muted-foreground"
                  aria-label={t("action.delete")}
                  onClick={() =>
                    setDrafts((current) => current.filter((item) => item.key !== draft.key))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => setDrafts((current) => [...current, emptyItem()])}
            >
              <Plus />
              {t("config.diets.new")}
            </Button>

            <p className="text-right text-sm text-muted-foreground">
              {t("config.diets.totalOffered")}:{" "}
              <span className="num font-medium text-foreground">
                {formatNumber(
                  drafts.reduce((sum, draft) => sum + (parseNumberInput(draft.kg) ?? 0), 0),
                  2,
                )}{" "}
                kg/cab/dia
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
