import { lazy, Suspense, useCallback, useState } from "react";
import AppLayout from "@/Layouts/AppLayout";
import { Head } from "@inertiajs/react";
import Link from "@/Components/Link";
import ManualBookToc from "@/Components/ManualBook/ManualBookToc";
import MarkdownMermaidRenderer from "@/Components/ManualBook/MarkdownMermaidRenderer";

// react-zoom-pan-pinch hanya dimuat saat gambar pertama kali diklik, bukan di
// bundle awal halaman Manual Book (pola dynamic import sama seperti `mermaid`).
const ManualBookImageLightbox = lazy(
  () => import("@/Components/ManualBook/ManualBookImageLightbox"),
);
import { Button } from "@/Components/ui/button";
import { ArrowLeft, Loader2Icon, PrinterIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({
  title,
  description,
  content_html: contentHtml,
}) {
  const { t } = useLaravelReactI18n();
  const [isReady, setIsReady] = useState(false);
  const [headings, setHeadings] = useState([]);
  const [lightbox, setLightbox] = useState({ open: false, src: "", alt: "" });

  const handleHeadingsChange = useCallback((next) => {
    setHeadings(next);
  }, []);

  const openLightbox = useCallback(({ src, alt }) => {
    setLightbox({ open: true, src, alt });
  }, []);

  const handleLightboxOpenChange = useCallback((open) => {
    if (!open) {
      setLightbox((current) => ({ ...current, open: false }));
    }
  }, []);

  return (
    <AppLayout>
      <Head title={title} />
      <div className="mx-auto max-w-6xl print:visible">
        <div className="grid grid-cols-1 gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="manual-book-content min-w-0 space-y-6">
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>

            <MarkdownMermaidRenderer
              html={contentHtml}
              onReadyChange={setIsReady}
              onHeadingsChange={handleHeadingsChange}
              onImageActivate={openLightbox}
            />
          </div>

          <div className="hidden space-y-4 lg:block">
            <div className="sticky top-4 z-10 flex items-center gap-2 print:hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" asChild>
                    <Link href={route("manualBook.index")}>
                      <ArrowLeft className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("core.manualBook.back", "Kembali ke Manual Book")}
                </TooltipContent>
              </Tooltip>

              <Button
                variant="outline"
                className="flex-1"
                disabled={!isReady}
                onClick={() => window.print()}
              >
                {isReady ? (
                  <PrinterIcon className="size-4" />
                ) : (
                  <Loader2Icon className="size-4 animate-spin" />
                )}
                {isReady
                  ? t("core.manualBook.print", "Cetak")
                  : t("core.manualBook.preparing", "Menyiapkan diagram...")}
              </Button>
            </div>

            <ManualBookToc headings={headings} />
          </div>

          <div className="fixed right-4 bottom-4 z-10 flex flex-col gap-2 lg:hidden print:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" asChild>
                  <Link href={route("manualBook.index")}>
                    <ArrowLeft className="size-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {t("core.manualBook.back", "Kembali ke Manual Book")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!isReady}
                  onClick={() => window.print()}
                >
                  {isReady ? (
                    <PrinterIcon className="size-4" />
                  ) : (
                    <Loader2Icon className="size-4 animate-spin" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isReady
                  ? t("core.manualBook.print", "Cetak")
                  : t("core.manualBook.preparing", "Menyiapkan diagram...")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {lightbox.open && (
        <Suspense fallback={null}>
          <ManualBookImageLightbox
            open={lightbox.open}
            src={lightbox.src}
            alt={lightbox.alt}
            onOpenChange={handleLightboxOpenChange}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}
