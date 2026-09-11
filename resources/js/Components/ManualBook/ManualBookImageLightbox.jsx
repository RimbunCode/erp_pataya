import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/Components/ui/dialog";
import { cn } from "@/lib/utils";
import { ImageOff, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

/**
 * Tombol kontrol di toolbar lightbox. Gayanya (latar semi-transparan di atas
 * gambar) dibuat lokal supaya tidak bergantung pada varian Button aplikasi yang
 * di-styling untuk latar terang.
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {() => void} props.onClick
 * @param {string} props.label
 * @returns {JSX.Element}
 */
function ToolbarButton({ children, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {children}
    </button>
  );
}

/**
 * Modal layar penuh untuk melihat gambar Manual Book pada resolusi & kualitas
 * aslinya. Gambar dimuat dari URL yang sama dengan gambar inline (tanpa
 * thumbnail terpisah), ditampilkan fit-to-viewport lewat `object-contain`, lalu
 * bisa di-zoom/pan dengan `react-zoom-pan-pinch`.
 *
 * State zoom/pan hidup di dalam `TransformWrapper`; karena `Dialog` melepas
 * seluruh subtree saat `open` menjadi `false`, tiap pembukaan modal selalu
 * mulai dari keadaan fit (tidak persist antar pembukaan).
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.src - URL gambar (path absolut `/manual-book-images/...`).
 * @param {string} props.alt - Teks alternatif; jadi judul sr-only + caption.
 * @param {(open: boolean) => void} props.onOpenChange
 * @returns {JSX.Element}
 */
export default function ManualBookImageLightbox({
  open,
  src,
  alt,
  onOpenChange,
}) {
  const { t } = useLaravelReactI18n();
  const [errored, setErrored] = useState(false);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  // Reset status muat tiap kali gambar (src) berganti atau modal dibuka ulang,
  // supaya sisa error/placeholder dari gambar sebelumnya tidak terbawa.
  useEffect(() => {
    if (open) {
      setErrored(false);
      setIsPlaceholder(false);
    }
  }, [open, src]);

  const title = alt || t("core.manualBook.imageTitle", "Gambar Manual Book");
  const closeLabel = t("core.manualBook.close", "Tutup");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideX
        forceAsDialog
        align="center"
        className="h-[92vh] max-w-[95vw] overflow-hidden border-0 bg-black/95 p-0"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {errored ? (
          <>
            <CloseButton
              label={closeLabel}
              onClick={() => onOpenChange(false)}
            />
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/80">
              <ImageOff className="size-10" />
              <p className="text-sm">
                {t(
                  "core.manualBook.imageUnavailable",
                  "Gambar tidak tersedia atau gagal dimuat.",
                )}
              </p>
            </div>
          </>
        ) : (
          <TransformWrapper
            initialScale={1}
            minScale={1}
            maxScale={8}
            centerOnInit
            wheel={{ step: 0.15 }}
            doubleClick={{ mode: "toggle", step: 2 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
                  <ToolbarButton
                    onClick={() => zoomOut()}
                    label={t("core.manualBook.zoomOut", "Perkecil")}
                  >
                    <Minus className="size-5" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => zoomIn()}
                    label={t("core.manualBook.zoomIn", "Perbesar")}
                  >
                    <Plus className="size-5" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => resetTransform()}
                    label={t(
                      "core.manualBook.zoomReset",
                      "Kembalikan ke ukuran pas",
                    )}
                  >
                    <RotateCcw className="size-5" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => onOpenChange(false)}
                    label={closeLabel}
                  >
                    <X className="size-5" />
                  </ToolbarButton>
                </div>

                <TransformComponent
                  wrapperClass="!h-full !w-full"
                  contentClass="!h-full !w-full flex items-center justify-center"
                >
                  <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    onError={() => setErrored(true)}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setIsPlaceholder(
                        img.naturalWidth <= 1 && img.naturalHeight <= 1,
                      );
                    }}
                    className={cn(
                      "max-h-full max-w-full select-none object-contain",
                      isPlaceholder && "size-40 opacity-0",
                    )}
                  />
                </TransformComponent>

                {isPlaceholder && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
                    <p className="rounded-md bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur">
                      {t(
                        "core.manualBook.imagePlaceholder",
                        "Screenshot untuk bagian ini belum ditambahkan.",
                      )}
                    </p>
                  </div>
                )}

                {alt && !isPlaceholder && (
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-8 text-center">
                    <p className="text-sm text-white/90">{alt}</p>
                  </div>
                )}
              </>
            )}
          </TransformWrapper>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tombol tutup mandiri untuk kondisi error (di luar `TransformWrapper`, jadi
 * tidak bisa memakai toolbar zoom).
 * @param {object} props
 * @param {string} props.label
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function CloseButton({ label, onClick }) {
  return (
    <div className="absolute right-3 top-3 z-20">
      <ToolbarButton onClick={onClick} label={label}>
        <X className="size-5" />
      </ToolbarButton>
    </div>
  );
}
