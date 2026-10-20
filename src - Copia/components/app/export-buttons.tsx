import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useState, useRef } from "react";
import { FileDown, FileSpreadsheet, Loader2, Download, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExportReport } from "@/lib/export-data";

export function ExportButtons({ getReport, disabled = false }: { getReport: () => ExportReport; disabled?: boolean }) {
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const running=useRef(false);
  const run = async (format: "pdf" | "excel") => {
    if (running.current || disabled) return;
    running.current=true;
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
      running.current=false;
      setBusy(null);
    }
  };
  return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" className="h-10" disabled={disabled||busy!==null} aria-label="Exportar relatório"><span className="inline-flex items-center gap-2">{busy?<Loader2 className="size-4 animate-spin"/>:<Download className="size-4"/>}{busy?"Exportando…":"Exportar"}<ChevronDown className="size-4"/></span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={disabled||busy!==null} onSelect={()=>void run("pdf")}><FileDown className="mr-2 size-4"/>Exportar PDF</DropdownMenuItem><DropdownMenuItem disabled={disabled||busy!==null} onSelect={()=>void run("excel")}><FileSpreadsheet className="mr-2 size-4"/>Exportar Excel</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
