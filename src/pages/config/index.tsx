import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, Cog, Package, Save, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useFarm, useSaveFarm } from "@/hooks/use-farm";

const SettingsHome = () => {
  const { t } = useTranslation();
  const { profile, isGestor, user } = useAuth();
  const farmQuery = useFarm();
  const saveFarm = useSaveFarm();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    if (farmQuery.data) {
      setName(farmQuery.data.name);
      setCity(farmQuery.data.city ?? "");
      setState(farmQuery.data.state ?? "");
    }
  }, [farmQuery.data]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error(t("toast.requiredFields"));
      return;
    }

    try {
      await saveFarm.mutateAsync({
        id: farmQuery.data?.id,
        name: name.trim(),
        city: city.trim() || null,
        state: state.trim() || null,
      });
      toast.success(t("config.farm.saved"));
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  const shortcuts = [
    { to: "/config/currais", icon: Package, labelKey: "config.pens.title", gestorOnly: true },
    { to: "/config/dietas", icon: BarChart3, labelKey: "config.diets.title", gestorOnly: true },
    { to: "/config/usuarios", icon: Users, labelKey: "config.users.title", gestorOnly: true },
  ].filter((item) => !item.gestorOnly || isGestor);

  return (
    <div className="space-y-5">
      <PageHeader titleKey="config.title" subtitleKey="config.subtitle" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">{t("config.farm.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField
              label={t("config.farm.name")}
              value={name}
              onChange={setName}
              disabled={!isGestor}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t("config.farm.city")} value={city} onChange={setCity} />
              <TextField label={t("config.farm.state")} value={state} onChange={setState} />
            </div>

            {isGestor ? (
              <Button className="h-11" onClick={() => void submit()} disabled={saveFarm.isPending}>
                <Save />
                {t("action.save")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("config.users.gestorOnly")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">
              {t("config.users.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-sm font-medium">{profile?.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              {profile ? (
                <div className="pt-2">
                  <StatusBadge
                    tone={isGestor ? "primary" : "muted"}
                    label={t(`status.role.${profile.role}`)}
                    size="sm"
                  />
                </div>
              ) : null}
            </div>

            <ul className="space-y-2">
              {shortcuts.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <item.icon className="size-4 text-muted-foreground" />
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Cog className="size-3.5" />
              {t("common.appSubtitle")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsHome;
