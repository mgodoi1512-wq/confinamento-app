import { FarmSystemSettings } from "@/components/farms/farm-system-settings";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CreditCard, Package, Save, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { LocationFields } from "@/components/form/location-fields";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useFarm, useSaveFarm } from "@/hooks/use-farm";

const SettingsHome = () => {
  const { t } = useTranslation();
  const { profile, isGestor, user, tenant } = useAuth();
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
    if (!isGestor || saveFarm.isPending) return;
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
    { to: "/config/currais", icon: Package, labelKey: "Locais de manejo", gestorOnly: true },
    { to: "/config/dietas", icon: BarChart3, labelKey: "config.diets.title", gestorOnly: true },
    { to: "/config/usuarios", icon: Users, labelKey: "config.users.title", gestorOnly: true },
  ].filter((item) => !item.gestorOnly || isGestor);

  return (
    <div className="min-w-0 space-y-5 pb-20">
      <PageHeader titleKey="config.title" subtitleKey="config.subtitle" actions={tenant?.isAdmin ? <Button asChild variant="outline" className="h-10"><Link to="/admin">Administração do sistema</Link></Button> : undefined} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 pb-3 pt-4">
            <CardTitle className="font-sans text-base font-semibold">{t("config.farm.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 pt-0 [&_input]:h-10 [&_select]:h-10 [&_label]:text-xs">
            <TextField
              label={t("config.farm.name")}
              value={name}
              onChange={setName}
              disabled={!isGestor || saveFarm.isPending}
              required
            />
            <LocationFields state={state} city={city} onStateChange={setState} onCityChange={setCity} disabled={!isGestor || saveFarm.isPending} />

            {isGestor ? (
              <Button className="h-10 w-40 shrink-0" onClick={() => void submit()} disabled={saveFarm.isPending}>
                <Save />
                {saveFarm.isPending ? "Salvando…" : "Salvar dados"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("config.users.gestorOnly")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pb-3 pt-4">
            <CardTitle className="font-sans text-base font-semibold">
              Acessos e conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 pt-0">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-sm font-medium">{profile?.full_name ?? "—"}</p>
              <p className="break-all text-xs text-muted-foreground">{user?.email}</p>
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
              {isGestor ? <li>
                <Link to="/config/plano" className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                  <CreditCard className="size-4 text-muted-foreground" />Meu plano
                </Link>
              </li> : null}
            </ul>


          </CardContent>
        </Card>
      </div>
      <FarmSystemSettings/>
    </div>
  );
};

export default SettingsHome;
