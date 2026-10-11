import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, ShieldPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { NumericField } from "@/components/app/numeric-field";
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
import { useDeleteProtocol, useProtocolItems, useProtocols, useSaveProtocol } from "@/hooks/use-protocols";
import { PROTOCOL_ITEM_KIND_OPTIONS } from "@/lib/constants";
import type { Protocol } from "@/lib/domain";
import { parseNumberInput } from "@/lib/format";

type ItemDraft = { key: string; kind: string; product: string; dose: string; withdrawal: string };

const emptyItem = (): ItemDraft => ({
  key: crypto.randomUUID(),
  kind: "vacina",
  product: "",
  dose: "",
  withdrawal: "0",
});

const Protocols = () => {
  const { t } = useTranslation();
  const { isGestor } = useAuth();

  const protocolsQuery = useProtocols();
  const itemsQuery = useProtocolItems();
  const saveProtocol = useSaveProtocol();
  const deleteProtocol = useDeleteProtocol();

  const protocols = useMemo(() => protocolsQuery.data ?? [], [protocolsQuery.data]);
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Protocol | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [drafts, setDrafts] = useState<ItemDraft[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(
    () =>
      protocols.map((protocol) => ({
        protocol,
        items: items.filter((item) => item.protocol_id === protocol.id),
      })),
    [protocols, items],
  );

  const openDialog = (protocol?: Protocol) => {
    setEditing(protocol ?? null);
    setName(protocol?.name ?? "");
    setDescription(protocol?.description ?? "");
    setIsActive(protocol?.is_active ?? true);
    setDrafts(
      protocol
        ? items
            .filter((item) => item.protocol_id === protocol.id)
            .map((item) => ({
              key: item.id,
              kind: item.kind,
              product: item.product,
              dose: item.dose ?? "",
              withdrawal: String(item.withdrawal_days),
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
      await saveProtocol.mutateAsync({
        protocol: {
          id: editing?.id,
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        },
        items: drafts.map((draft) => ({
          kind: draft.kind,
          product: draft.product.trim(),
          dose: draft.dose.trim() || null,
          withdrawal_days: parseNumberInput(draft.withdrawal) ?? 0,
        })),
      });
      toast.success(t("health.protocols.saved"));
      setOpen(false);
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  const remove = async (protocol: Protocol) => {
    try {
      await deleteProtocol.mutateAsync(protocol.id);
      toast.success(t("health.protocols.deleted"));
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  if (!isGestor) {
    return (
      <EmptyState icon={ShieldPlus} titleKey="empty.permission.title" descriptionKey="empty.permission.description" />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="health.protocols.title"
        subtitleKey="health.protocols.subtitle"
        actions={
          <Button className="h-10" onClick={() => openDialog()}>
            <Plus />
            {t("health.protocols.new")}
          </Button>
        }
      />

      {grouped.length === 0 ? (
        <EmptyState
          icon={ShieldPlus}
          titleKey="health.protocols.empty.title"
          descriptionKey="health.protocols.empty.description"
          action={
            <Button className="h-10" onClick={() => openDialog()}>
              {t("health.protocols.new")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grouped.map(({ protocol, items: protocolItems }) => (
            <Card key={protocol.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="font-display text-lg">{protocol.name}</CardTitle>
                    <p className="truncate text-xs text-muted-foreground">
                      {protocol.description ?? t("common.noData")}
                    </p>
                  </div>
                  <StatusBadge
                    tone={protocol.is_active ? "success" : "muted"}
                    label={protocol.is_active ? t("config.diets.active") : t("config.diets.inactive")}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {protocolItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.product}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t(`status.protocolItem.${item.kind}`)} · {item.dose ?? t("common.noData")}
                        </p>
                      </div>
                      {item.withdrawal_days > 0 ? (
                        <StatusBadge
                          tone="agro"
                          label={`${item.withdrawal_days} ${t("common.unit.days")}`}
                          size="sm"
                        />
                      ) : null}
                    </li>
                  ))}
                  {protocolItems.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">{t("common.noData")}</li>
                  ) : null}
                </ul>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-10 flex-1" onClick={() => openDialog(protocol)}>
                    {t("action.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 text-destructive"
                    onClick={() => void remove(protocol)}
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
            <DialogTitle>
              {editing ? t("health.protocols.edit") : t("health.protocols.new")}
            </DialogTitle>
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
            <TextField label={t("field.notes")} value={description} onChange={setDescription} />
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
            <p className="text-sm font-medium">{t("health.protocols.items")}</p>
            {drafts.map((draft, index) => (
              <div key={draft.key} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
                <SelectField
                  label={t("field.kind")}
                  value={draft.kind}
                  onChange={(value) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.key === draft.key ? { ...item, kind: value } : item,
                      ),
                    )
                  }
                  options={PROTOCOL_ITEM_KIND_OPTIONS}
                />
                <TextField
                  label={t("field.product")}
                  value={draft.product}
                  onChange={(value) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.key === draft.key ? { ...item, product: value } : item,
                      ),
                    )
                  }
                />
                <TextField
                  label={t("field.dose")}
                  value={draft.dose}
                  onChange={(value) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.key === draft.key ? { ...item, dose: value } : item,
                      ),
                    )
                  }
                />
                <div className="flex items-end gap-2">
                  <NumericField
                    className="flex-1"
                    label={t("field.withdrawalDays")}
                    inputMode="numeric"
                    value={draft.withdrawal}
                    onValueChange={(value) =>
                      setDrafts((current) =>
                        current.map((item) =>
                          item.key === draft.key ? { ...item, withdrawal: value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mb-1 h-11 w-11 text-muted-foreground"
                    aria-label={`${t("action.delete")} ${index + 1}`}
                    onClick={() =>
                      setDrafts((current) => current.filter((item) => item.key !== draft.key))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => setDrafts((current) => [...current, emptyItem()])}
            >
              <Plus />
              {t("health.protocols.addItem")}
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saveProtocol.isPending}>
              <Save />
              {t("action.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Protocols;
