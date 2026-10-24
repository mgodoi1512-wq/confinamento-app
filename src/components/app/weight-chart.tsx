import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { LineChart } from "lucide-react";
import type { WeightChartProps } from "./weight-chart-content";
export type { WeightChartProps, WeightPoint } from "./weight-chart-content";
const Chart = lazy(() => import("./weight-chart-content").then(module => ({ default: module.WeightChart })));

/** Só busca a biblioteca de gráficos quando o painel se aproxima da tela. */
export function WeightChart(props: WeightChartProps) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!root.current) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const placeholder = <div role="status" className="flex items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground" style={{ minHeight: (props.height ?? 240) + 80 }}>Carregando gráfico…</div>;
  const hasMeasurements = props.points.some(point => point.weight !== null);
  return <div ref={root}>{!hasMeasurements ? <EmptyState icon={LineChart} titleKey={props.emptyTitleKey ?? "weighings.empty.title"} descriptionKey={props.emptyDescriptionKey ?? "weighings.empty.description"} /> : visible ? <Suspense fallback={placeholder}><Chart {...props} /></Suspense> : placeholder}</div>;
}
