import { usePublicPlanPrices } from "@/hooks/use-public-plan-prices";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard as CreditIcon, BarChart3, Check, ChevronDown, ClipboardList, HeartPulse, Mail, MapPin, Menu, Package, ShieldCheck, Smartphone, Sprout, TrendingUp, UtensilsCrossed, Wallet, X } from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { CattleNavIcon } from "@/components/app/navigation-icons";
import { tutorialJourney } from "@/lib/tutorial";
import { LEGAL_CONTACT } from "@/lib/legal-documents";
import "./home.css";

const signup = "/login?modo=cadastro";
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const maxAnnualInstallments = 12;
const features = [
  { icon: CattleNavIcon, title: "Rebanho e lotes", text: "Animais identificados, entradas, movimentações e locais de manejo organizados." },
  { icon: UtensilsCrossed, title: "Nutrição e trato", text: "Dietas, adaptação e refeições do dia, com acompanhamento de consumo e estoque." },
  { icon: HeartPulse, title: "Sanidade", text: "Protocolos, tratamentos e ocorrências reunidos no histórico do rebanho." },
  { icon: BarChart3, title: "Pesagens e GMD", text: "Pesagens individuais ou por lote, ganho de peso e projeções de desempenho." },
  { icon: Package, title: "Estoque", text: "Ingredientes, produção de ração, volumoso, bovinos e equipamentos." },
  { icon: Wallet, title: "Fluxo de caixa", text: "Entradas, saídas e vencimentos para acompanhar os compromissos da fazenda." },
];
const previews = [
  { key: "dashboard", title: "Visão geral", text: "Seu rebanho, os indicadores e as prioridades do dia em uma só tela.", icon: CattleNavIcon, image: "/home/painel.webp" },
  { key: "feeding", title: "Rotina de trato", text: "Consulte as refeições fornecidas e acompanhe a recomendação por lote.", icon: Sprout, image: "/home/trato.webp" },
  { key: "finance", title: "Controle financeiro", text: "Confira o caixa e os pagamentos previstos para planejar a operação.", icon: BarChart3, image: "/home/financeiro.webp" },
];
const journeyIcons = [MapPin, MapPin, Sprout, Package, ClipboardList, UtensilsCrossed, HeartPulse, BarChart3, TrendingUp, Wallet];
const faqs = [
  ["Posso acessar pelo celular?", "Sim. A plataforma pode ser acessada pelo navegador do celular, tablet ou computador, com conexão à internet. As telas se adaptam ao tamanho disponível."],
  ["Posso cadastrar minha equipe?", "Sim. O responsável pela fazenda pode convidar pessoas com suas próprias contas e definir os perfis disponíveis. Cada integrante deve utilizar seu próprio acesso."],
  ["O LiBen atende qual sistema de criação?", "Você pode informar confinamento, semiconfinamento ou a pasto na configuração da fazenda. Cadastros, locais e rotinas devem refletir o manejo utilizado; confira as funções adequadas à sua operação."],
  ["Como funcionam os pagamentos?", "Após criar a conta, siga as orientações de acesso e escolha o plano quando a contratação estiver disponível. Há Pix e cartão; o anual no cartão permite até 12 parcelas sem juros. Consulte as condições exibidas antes de confirmar."],
  ["Como funciona a renovação e o cancelamento?", "No mensal por cartão, a renovação é automática até o cancelamento. No Pix, cada fatura deve ser paga pelo usuário. O anual parcelado no cartão não renova automaticamente. Consulte os detalhes em Meu plano e os Termos de Uso."],
  ["Posso exportar meus registros?", "As páginas com exportação permitem gerar PDF ou Excel conforme o relatório disponível. Confira os filtros, as datas e as unidades antes de compartilhar os arquivos."],
];

export default function Home() {
  const prices = usePublicPlanPrices();
  const publicPlans = prices.isError ? undefined : prices.data;
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const step = tutorialJourney[activeStep];
  const selectedPreview = previews.find(item => item.key === preview);
  return <div className="liben-home" id="inicio">
    <a className="home-skip" href="#conteudo">Ir para o conteúdo</a>
    <header className="home-nav">
      <div className="home-container home-nav-inner">
        <a className="home-brand" href="#inicio" aria-label="LiBen — início"><img src="/logo-liben-2.webp" alt="" width="42" height="42" /><span><strong>LiBen</strong><small>GESTÃO DE FAZENDAS</small></span></a>
        <nav className={`home-nav-links ${menuOpen ? "is-open" : ""}`} aria-label="Navegação da apresentação" id="home-menu">{[["#recursos", "Recursos"], ["#como-funciona", "Como funciona"], ["#planos", "Planos"]].map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
        <div className="home-nav-actions"><ThemeToggle /><Link className="home-button is-quiet" to="/login">Entrar</Link><Link className="home-button home-nav-signup" to={signup}>Criar conta</Link><button className="home-menu-button" type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="home-menu" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X /> : <Menu />}</button></div>
      </div>
    </header>
    <main id="conteudo">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-container home-hero-grid">
          <div className="home-hero-copy"><span className="home-eyebrow">DO MANEJO À GESTÃO</span><h1 id="home-title">Sua fazenda.<br /><em>Na palma da mão.</em></h1><p>Rebanho, alimentação, estoque e financeiro em um só lugar.</p><div className="home-hero-actions"><Link className="home-button" to={signup}>Criar minha conta<ArrowRight /></Link><a className="home-button is-quiet" href="#plataforma">Conhecer a plataforma</a></div><span className="home-hero-footnote" style={{ alignItems: "flex-start" }}><Smartphone className="mt-0.5 shrink-0" /><span className="min-w-0">No celular, no tablet e no computador.<small className="mt-1 block" style={{ color: "#efc08f", fontSize: "inherit" }}>Em breve: aplicativo com modo offline.</small></span></span></div>
          <figure className="home-device"><div className="home-device-stage"><div className="home-notebook"><div className="home-device-screen"><div className="home-device-top"><span /><span /><span /><small>LiBen · Gestão de fazendas</small></div><img src="/home/painel-notebook.webp" alt="Painel da fazenda no computador, com indicadores do rebanho e financeiro" width="1914" height="944" fetchPriority="high" /></div><div className="home-device-base" /></div><div className="home-phone"><div className="home-phone-camera" aria-hidden="true" /><div className="home-phone-screen"><img src="/home/painel-celular.webp" alt="Painel da fazenda no celular, com indicadores e navegação móvel" width="591" height="1280" fetchPriority="high" /></div></div></div><figcaption>A mesma plataforma no computador e no celular</figcaption></figure>
        </div>
      </section>
      <section className="home-section" id="plataforma" aria-labelledby="platform-title">
        <div className="home-container"><div className="home-section-heading"><span className="home-eyebrow">CONHEÇA POR DENTRO</span><h2 id="platform-title">Tudo o que sua fazenda precisa, conectado.</h2><p>Informação organizada para acompanhar a rotina e decidir com mais clareza.</p></div>
          <div className="home-preview-grid">{previews.map(item => <article className="home-preview-card" key={item.key}><button type="button" className="home-preview-image" onClick={() => setPreview(item.key)} aria-label={`Ampliar tela: ${item.title}`}><img src={item.image} alt={`Tela de ${item.title.toLowerCase()} do LiBen, com dados demonstrativos`} width="1200" height="800" loading="lazy" /><span>Ampliar tela<ArrowRight /></span></button><div className="home-preview-copy"><item.icon aria-hidden="true" /><div><h3>{item.title}</h3><p>{item.text}</p></div></div></article>)}</div><p className="home-demo-note">As imagens mostram telas do LiBen preenchidas com dados de demonstração.</p>
          <div className="home-feature-grid" id="recursos">{features.map(item => <article className="home-feature" key={item.title}><item.icon aria-hidden="true" /><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div><p className="home-extra"><ShieldCheck />Relatórios em PDF e Excel e consulta de mercado para complementar a gestão.</p>
        </div>
      </section>
      <section className="home-journey-section" id="como-funciona" aria-labelledby="journey-title"><div className="home-container home-journey-grid"><div className="home-journey-copy"><span className="home-eyebrow">UM CICLO DE GESTÃO</span><h2 id="journey-title">Da entrada<br />ao resultado.</h2><p>Prepare a fazenda, organize a rotina e acompanhe o desempenho até a saída dos animais.</p><ul><li><Check />Cadastros e planejamento conectados.</li><li><Check />Manejo registrado ao longo do ciclo.</li><li><Check />Estoque e financeiro acompanhados.</li></ul><div className="home-system-chips"><span>Confinamento</span><span>Semiconfinamento</span><span>A pasto</span></div></div><div className="home-journey"><div className="home-orbit"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth=".3" strokeDasharray="1 2" /></svg><div className="home-orbit-center" aria-live="polite" aria-atomic="true"><small>ETAPA {String(activeStep + 1).padStart(2, "0")} DE 10</small><h3>{step.shortTitle}</h3><p>{step.result}</p></div>{tutorialJourney.map((entry, index) => {const angle = (index * 36 - 90) * Math.PI / 180; const Icon = journeyIcons[index];return <button key={entry.title} type="button" style={{ left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 40 * Math.sin(angle)}%` }} aria-pressed={activeStep === index} aria-label={`Etapa ${index + 1}: ${entry.title}`} title={entry.title} onClick={() => setActiveStep(index)}><span>{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden="true" /></button>;})}</div><p className="home-orbit-caption">Toque ou clique nas etapas para conhecer o resultado de cada uma.</p></div></div></section>
      <section className="home-section home-pricing" id="planos" aria-labelledby="pricing-title"><div className="home-container"><div className="home-section-heading"><span className="home-eyebrow">PLANOS</span><h2 id="pricing-title">Escolha o plano para sua fazenda.</h2><p>Conheça as ferramentas e confira as condições antes de contratar.</p></div><div className="home-price-grid">{(["monthly", "annual"] as const).map(plan => <article className={`home-price-card ${plan === "annual" ? "is-annual" : ""}`} key={plan}>{plan === "annual" && publicPlans && publicPlans.annual < publicPlans.monthly * 12 && <span className="home-price-badge">Melhor valor</span>}<h3>{plan === "monthly" ? "Mensal" : "Anual"}</h3><p className="home-price"><strong>{publicPlans ? money(publicPlans[plan]) : prices.isPending ? "Consultando…" : "Consulte o plano"}</strong><span>{plan === "monthly" ? "por mês" : "12 meses de acesso"}</span></p><p className="home-price-saving">{plan === "annual" ? publicPlans && publicPlans.annual < publicPlans.monthly * 12 ? `Economize ${money(publicPlans.monthly * 12 - publicPlans.annual)} em relação a 12 mensalidades.` : "12 meses para acompanhar sua fazenda." : "Uma assinatura para acompanhar a rotina da fazenda."}</p><ul>{["Rebanho, alimentação, sanidade e pesagens", "Estoque, financeiro e relatórios", "Equipe com perfis de acesso"].map(text => <li key={text}><Check />{text}</li>)}</ul><p className="home-payment-note"><CreditIcon />{plan === "annual" ? `Cartão em até ${maxAnnualInstallments}x sem juros` : "Pix ou cartão · confira a renovação"}</p><Link className="home-button" to={`${signup}&plano=${plan}`}>{plan === "monthly" ? "Escolher mensal" : "Escolher anual"}<ArrowRight /></Link></article>)}</div><p className="home-demo-note" role="status">{prices.isError && <>Não foi possível consultar os preços agora. <button type="button" className="underline" onClick={() => void prices.refetch()}>Tentar novamente</button>. </>}O cadastro não gera cobrança. O plano e o pagamento são confirmados na etapa de contratação.</p></div></section>
      <section className="home-section home-faq" id="duvidas"><div className="home-container home-faq-grid"><div><span className="home-eyebrow">PODEMOS AJUDAR?</span><h2>Dúvidas frequentes</h2><p>Conheça o funcionamento antes de começar.</p><a className="home-contact" href={`mailto:${LEGAL_CONTACT}`}><Mail />Fale com o LiBen</a></div><div className="home-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>
    </main>
    <footer className="home-footer"><div className="home-container home-footer-grid"><a className="home-brand" href="#inicio"><img src="/logo-liben-2.webp" alt="" width="40" height="40" /><span><strong>LiBen</strong><small>GESTÃO DE FAZENDAS</small></span></a><p>Mais controle para o seu dia a dia.</p><nav aria-label="Informações institucionais"><Link to="/termos-de-uso">Termos de Uso</Link><Link to="/privacidade">Privacidade</Link><a href={`mailto:${LEGAL_CONTACT}`}>Contato</a></nav><a href={`mailto:${LEGAL_CONTACT}`} className="home-footer-email"><Mail />{LEGAL_CONTACT}</a></div></footer>
    {selectedPreview && <PreviewDialog title={selectedPreview.title} image={selectedPreview.image} onClose={() => setPreview(null)} />}
  </div>;
}

function PreviewDialog({ title, image, onClose }: { title: string; image: string; onClose: () => void }) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70" /><Dialog.Content className="fixed left-1/2 top-1/2 z-[90] flex max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl"><div className="flex items-center justify-between gap-3 border-b border-border p-4"><div><Dialog.Title className="font-semibold">{title}</Dialog.Title><Dialog.Description className="text-xs text-muted-foreground">Tela da plataforma com dados demonstrativos.</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Fechar imagem" className="grid size-11 place-items-center rounded-md hover:bg-muted"><X /></button></Dialog.Close></div><div className="min-h-0 overflow-auto p-2"><img src={image} alt={`Tela ampliada de ${title}`} className="h-auto w-full rounded" /></div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
