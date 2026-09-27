import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import { useLaravelReactI18n } from "laravel-react-i18n";

const STROKE_COLOR = "#0f172a";
const STROKE_WIDTH = 2.5;

/**
 * Kanvas gambar tanda tangan.
 *
 * Hasilnya sudah transparan sejak lahir (konteks tidak pernah diisi warna
 * latar), sehingga jalur simpannya melewati pipeline threshold di server:
 * menerapkan threshold pada gambar beralpha justru merusaknya.
 *
 * Tanpa pustaka luar. Event pointer dipakai, bukan mouse/touch terpisah,
 * karena satu jalur kode itu sudah menangani mouse, stylus, dan sentuh
 * sekaligus.
 */
export default function SignatureCanvas({ onSave, onCancel, saving = false }) {
  const { t } = useLaravelReactI18n();
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const prepareContext = useCallback((canvas) => {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Ukuran buffer mengikuti devicePixelRatio supaya goresan tidak buram di
    // layar retina; ukuran CSS-nya tetap mengikuti tata letak.
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));

    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = STROKE_WIDTH;
    ctx.strokeStyle = STROKE_COLOR;

    return ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    prepareContext(canvas);
  }, [prepareContext]);

  const pointFromEvent = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;

    const { x, y } = pointFromEvent(event);
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Titik tunggal (tap tanpa geser) tetap terhitung goresan.
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();

    setHasStroke(true);
  };

  const handlePointerMove = (event) => {
    if (!drawingRef.current) return;

    const { x, y } = pointFromEvent(event);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;

    canvas.toBlob((blob) => {
      if (blob) onSave?.(blob);
    }, "image/png");
  };

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        aria-label={t("user.signature.draw")}
        role="img"
        // touch-action:none supaya goresan di perangkat sentuh tidak ikut
        // men-scroll halaman.
        className="w-full h-40 border rounded-md cursor-crosshair touch-none bg-background"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("user.signature.cancel")}
        </Button>
        <Button type="button" variant="outline" onClick={handleClear}>
          {t("user.signature.clear")}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!hasStroke || saving}
          onClick={handleSave}
        >
          {t("user.signature.save")}
        </Button>
      </div>
    </div>
  );
}
