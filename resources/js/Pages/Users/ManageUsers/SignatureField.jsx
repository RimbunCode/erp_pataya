import React, { useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { PenLine, Trash2, UploadIcon } from "lucide-react";
import SignatureCanvas from "./SignatureCanvas";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Bagian tanda tangan pada halaman profil.
 *
 * Hanya dirender untuk pemilik akun. Batas sebenarnya ada di server
 * (`UserController::exceptPermission`), yang mengunci mutasi tanda tangan ke
 * pemilik tanpa jalan keluar lewat permission; penyembunyian di sini semata
 * agar tombol yang pasti ditolak tidak ditampilkan.
 */
export default function SignatureField({ user, canEdit }) {
  const { t } = useLaravelReactI18n();
  const fileInputRef = useRef(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // `has_signature`, bukan `signature_file_id`: id berkasnya sengaja
  // disembunyikan dari serialisasi (NFR3), dan keberadaan tanda tangan sudah
  // cukup dijawab boolean.
  const signatureUrl = user.has_signature
    ? route("users.showSignature", user.id)
    : null;

  const submit = (blob, source, filename) => {
    setSaving(true);
    router.post(
      route("users.signature", user.id),
      { signature: new File([blob], filename, { type: blob.type }), source },
      {
        forceFormData: true,
        preserveScroll: true,
        reset: ["user", "auth"],
        onFinish: () => {
          setSaving(false);
          setDrawOpen(false);
        },
      },
    );
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    submit(file, "upload", file.name);
    // Reset supaya memilih berkas yang sama dua kali tetap memicu change.
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("user.signature.title")}</span>

      <div
        // Latar kotak-kotak: tanpa ini, tanda tangan hitam transparan di atas
        // kartu putih terlihat sama persis dengan tanda tangan hitam di atas
        // kertas putih, dan user tidak punya cara tahu apakah penghapusan
        // background berhasil.
        className="flex items-center justify-center w-full h-32 border rounded-md"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #cbd5e1 25%, transparent 25%)," +
            "linear-gradient(-45deg, #cbd5e1 25%, transparent 25%)," +
            "linear-gradient(45deg, transparent 75%, #cbd5e1 75%)," +
            "linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt={t("user.signature.preview_alt")}
            className="object-contain max-h-full"
          />
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("user.signature.not_signed_yet")}
          </span>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
            className="hidden"
            data-testid="signature-upload-input"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="size-4" />
            {t("user.signature.upload")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setDrawOpen(true)}
          >
            <PenLine className="size-4" />
            {t("user.signature.draw")}
          </Button>
          {signatureUrl && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={saving}
              onClick={() =>
                router.delete(route("users.removeSignature", user.id), {
                  preserveScroll: true,
                  reset: ["user", "auth"],
                })
              }
            >
              <Trash2 className="size-4" />
              {t("user.signature.remove")}
            </Button>
          )}
        </div>
      )}

      <Dialog open={drawOpen} onOpenChange={setDrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("user.signature.draw")}</DialogTitle>
          </DialogHeader>
          <SignatureCanvas
            saving={saving}
            onCancel={() => setDrawOpen(false)}
            onSave={(blob) => submit(blob, "canvas", "signature.png")}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
