import { useReducer } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, MousePointer2, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialLotDemo, lotDemoReducer } from "@/lib/tutorial";

const Field = ({ label, value }: { label: string; value: string }) => <div className="space-y-1"><p className="text-xs text-muted-foreground">{label}</p><div className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium">{value}</div></div>;

export const LotTutorialDemo = () => {
  const [state, dispatch] = useReducer(lotDemoReducer, initialLotDemo);
  const labels = ["Lista de lotes", "Identificação", "Pesagem e preço", "Sanidade e alocação", "Conferência"];
  return <section aria-label="Demonstração de criação de lote" className="overflow-hidden rounded-xl border border-primary/30 bg-card">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Experimente clicar</p><h3 className="mt-1 font-display text-lg font-semibold">Criar um lote de exemplo</h3></div><span className="rounded-full border border-primary/20 px-2 py-1 text-xs font-medium">Demonstração</span></header>
    <div className="space-y-4 p-4 sm:p-5">
      <p className="text-xs leading-relaxed text-muted-foreground">Ambiente ilustrativo com dados fictícios. Nenhum botão desta demonstração grava animais ou lotes na fazenda.</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{state.stage + 1}/5</span><span aria-live="polite">{labels[state.stage]}</span></div>
      <div key={state.stage} className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-200">
        {state.stage === 0 && <><div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3"><p className="font-semibold">Lotes</p><Button onClick={() => dispatch("start")} className="motion-safe:animate-pulse"><Plus />Novo lote</Button></div><p className="flex items-center gap-2 text-sm"><MousePointer2 className="size-4 shrink-0 text-primary" />Clique em Novo lote para começar.</p></>}
        {state.stage === 1 && <><div className="grid grid-cols-2 gap-3"><Field label="Código" value="Lote exemplo" /><Field label="Quantidade" value="10 animais" /><Field label="Raça" value="Nelore" /><Field label="Peso-alvo" value="520 kg" /></div><p className="text-sm text-muted-foreground">Na página real, preencha também entrada, origem e os demais dados do grupo.</p></>}
        {state.stage === 2 && <><Field label="Modo de entrada" value="Por lote · peso médio" /><Field label="Peso médio de entrada" value="350 kg por cabeça" /><Field label="Cadastro automático de animais" value="Ativado · confira os brincos sugeridos" /><p className="text-sm text-muted-foreground">Na página real, confira a sequência dos brincos e informe o preço por cabeça, se desejar. No modo individual, preencha brinco, peso e preço de cada animal. O preço não gera pagamento automático no caixa.</p></>}
        {state.stage === 3 && <><div className="space-y-1"><label htmlFor="tutorial-demo-pen" className="text-sm font-medium">Curral de exemplo (obrigatório)</label><select id="tutorial-demo-pen" value={state.penChosen ? "example" : ""} onChange={event => dispatch(event.target.value ? "choose-pen" : "clear-pen")} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Selecione o curral</option><option value="example">Curral exemplo · 20 vagas livres</option></select></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Dieta (opcional)" value="Sem dieta" /><Field label="Protocolo (opcional)" value="Sem protocolo" /></div><p className="text-xs text-muted-foreground">Aplicar protocolo ao lote começa desmarcado. O lote precisa de um curral com vagas suficientes.</p></>}
        {state.stage === 4 && <div role="status" className="space-y-3 rounded-lg bg-primary/5 p-4"><CheckCircle2 className="size-8 text-primary" /><p className="font-semibold">Exemplo concluído!</p><p className="text-sm leading-relaxed">Você conferiu um lote com 10 animais, peso médio de 350 kg e um curral selecionado. Nenhum cadastro real foi criado.</p><Button variant="outline" onClick={() => dispatch("reset")}><RotateCcw />Repetir demonstração</Button></div>}
      </div>
      {state.stage > 0 && state.stage < 4 && <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4"><Button variant="outline" onClick={() => dispatch("back")}><ArrowLeft />Voltar</Button>{state.stage < 3 ? <Button onClick={() => dispatch("next")}>Avançar<ArrowRight /></Button> : <Button disabled={!state.penChosen} onClick={() => dispatch("create")}>Criar lote de exemplo</Button>}</div>}
    </div>
  </section>;
};
