import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore, useCallback } from "react";
import { Button } from "@/components/ui/button";

export const QueryErrors = () => {
  const client = useQueryClient();
  useIsFetching();
  const subscribe = useCallback((notify: () => void) => client.getQueryCache().subscribe(notify), [client]);
  const snapshot = useCallback(() => client.getQueryCache().getAll()
    .filter((query) => query.state.status === "error" && query.getObserversCount() > 0)
    .map((query) => query.queryHash).join("|"), [client]);
  const errors = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!errors) return null;
  return <div role="alert" className="m-4 rounded-lg border border-destructive p-3 text-sm">
    Não foi possível carregar alguns dados. Os indicadores podem estar incompletos.
    <Button variant="outline" className="ml-3" onClick={() => void client.refetchQueries({ type: "active" })}>Tentar novamente</Button>
  </div>;
};
