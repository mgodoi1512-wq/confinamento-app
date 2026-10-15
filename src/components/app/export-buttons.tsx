import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExportReport } from "@/lib/export-data";

export function ExportButtons({ getReport, disabled = false }: { getReport: () => ExportReport; disabled?: boolean }) {
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const run = async (format: "pdf" | "excel") => {
    if (busy) return;
    setBusy(format);
    try {
      const report = getReport();
      if (!report.rows.length) {
        toast.info("Não há registros para exportar com os filtros atuais.");
        return;
      }
      const { exportExcel, exportPdf } = await import("@/lib/export-files");
      await (format === "excel" ? exportExcel(report) : exportPdf(report));
      toast.success("Relatório gerado.");
    } catch (error) {
      console.error("Falha ao exportar relatório", error);
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };
  return <>
    <Button type="button" variant="outline" className="h-10" disabled={disabled || busy !== null} onClick={() => void run("pdf")}>
      {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileDown />} Exportar PDF
    </Button>
    <Button type="button" variant="outline" className="h-10" disabled={disabled || busy !== null} onClick={() => void run("excel")}>
      {busy === "excel" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Exportar Excel
    </Button>
  </>;
}
