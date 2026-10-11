import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { Beef } from "lucide-react";

import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404: rota inexistente acessada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Beef className="size-5" />
        </span>
        <p className="font-display text-4xl font-semibold tracking-tight">404</p>
        <p className="font-display text-lg font-semibold">{t("notFound.title")}</p>
        <p className="text-sm text-muted-foreground">{t("notFound.description")}</p>
        <Button asChild className="h-11">
          <Link to="/">{t("notFound.actions.backHome")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
