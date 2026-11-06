import { Capacitor } from "@capacitor/core";

/** Verdadeiro somente dentro do aplicativo (Android/iOS); no navegador continua o download normal. */
export const isNativeApp = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const toBase64 = (bytes: Uint8Array): string => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};

/**
 * No aplicativo, o WebView não baixa arquivos gerados no navegador (blob + link).
 * Gravamos o arquivo no cache do aparelho e abrimos a tela de compartilhar do sistema
 * (WhatsApp, Drive, leitor de PDF, Excel...). Cancelar o compartilhamento não é erro.
 */
export async function shareFileNative(name: string, data: ArrayBuffer | Uint8Array): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const written = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache });
  try {
    await Share.share({ title: name, dialogTitle: "Compartilhar relatório", url: written.uri });
  } catch (error) {
    if (!/cancel/i.test(error instanceof Error ? error.message : String(error))) throw error;
  }
}

type PdfLike = { output(type: "arraybuffer"): ArrayBuffer; save(name: string): unknown };

/** PDF: compartilha no aplicativo e salva (download) no navegador. */
export async function savePdf(doc: PdfLike, name: string): Promise<void> {
  if (isNativeApp()) { await shareFileNative(name, doc.output("arraybuffer")); return; }
  doc.save(name);
}
