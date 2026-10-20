import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const states = [
  ["AC", "Acre", 12], ["AL", "Alagoas", 27], ["AP", "Amapá", 16], ["AM", "Amazonas", 13],
  ["BA", "Bahia", 29], ["CE", "Ceará", 23], ["DF", "Distrito Federal", 53], ["ES", "Espírito Santo", 32],
  ["GO", "Goiás", 52], ["MA", "Maranhão", 21], ["MT", "Mato Grosso", 51], ["MS", "Mato Grosso do Sul", 50],
  ["MG", "Minas Gerais", 31], ["PA", "Pará", 15], ["PB", "Paraíba", 25], ["PR", "Paraná", 41],
  ["PE", "Pernambuco", 26], ["PI", "Piauí", 22], ["RJ", "Rio de Janeiro", 33], ["RN", "Rio Grande do Norte", 24],
  ["RS", "Rio Grande do Sul", 43], ["RO", "Rondônia", 11], ["RR", "Roraima", 14], ["SC", "Santa Catarina", 42],
  ["SP", "São Paulo", 35], ["SE", "Sergipe", 28], ["TO", "Tocantins", 17],
] as const;
type Municipality = { id: number; nome: string };
type Props = { state: string; city: string; onStateChange: (value: string) => void; onCityChange: (value: string) => void; disabled?: boolean };
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/** Seleção dependente com dados públicos do IBGE, cache por UF e cancelamento. */
export const LocationFields = ({ state, city, onStateChange, onCityChange, disabled = false }: Props) => {
  const id = useId();
  const selected = states.find(([uf, name]) => normalize(state) === normalize(uf) || normalize(state) === normalize(name));
  const cities = useQuery({
    queryKey: ["ibge-municipalities", selected?.[0]],
    enabled: Boolean(selected), staleTime: 86_400_000, retry: 1,
    queryFn: async ({ signal }): Promise<Municipality[]> => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, 15_000);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selected![2]}/municipios?orderBy=nome`, { signal: controller.signal });
        if (!response.ok) throw new Error("Não foi possível carregar as cidades.");
        const data: unknown = await response.json();
        if (!Array.isArray(data) || data.some(item => typeof item?.id !== "number" || typeof item?.nome !== "string")) throw new Error("A lista de cidades está indisponível.");
        return (data as Municipality[]).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
    },
  });
  const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60";
  const loading = Boolean(selected) && cities.isPending;
  const legacyCity = city && !cities.data?.some(item => item.nome === city);
  return <div className="space-y-4">
    <div className="space-y-1.5">
      <label htmlFor={`${id}-state`} className="block text-sm font-medium">Estado</label>
      <select id={`${id}-state`} className={selectClass} value={selected?.[0] ?? state} disabled={disabled}
        onChange={event => { onStateChange(event.target.value); onCityChange(""); }}>
        <option value="">Selecione o estado</option>
        {state && !selected ? <option value={state}>{state} (cadastrado)</option> : null}
        {states.map(([uf, name]) => <option key={uf} value={uf}>{uf} — {name}</option>)}
      </select>
    </div>
    <div className="space-y-1.5">
      <label htmlFor={`${id}-city`} className="block text-sm font-medium">Cidade</label>
      <select id={`${id}-city`} className={selectClass} value={city} disabled={disabled || !selected || loading || cities.isError}
        aria-busy={loading} onChange={event => onCityChange(event.target.value)}>
        <option value="">{!selected ? "Selecione primeiro o estado" : loading ? "Carregando cidades..." : cities.isError ? "Não foi possível carregar" : "Selecione a cidade"}</option>
        {legacyCity ? <option value={city}>{city} (cadastrada)</option> : null}
        {cities.data?.map(item => <option key={item.id} value={item.nome}>{item.nome}</option>)}
      </select>
      {cities.isError ? <div role="alert" className="space-y-2 text-sm text-destructive">
        <p>Não foi possível consultar as cidades. Confira sua conexão e tente novamente.</p>
        <Button type="button" variant="outline" size="sm" disabled={disabled || cities.isFetching} onClick={() => void cities.refetch()}>Tentar novamente</Button>
      </div> : null}
    </div>
  </div>;
};
