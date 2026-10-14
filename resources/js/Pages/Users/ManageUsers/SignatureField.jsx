import React, { useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
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
 * @param {object} props
 * @param {{id: string, name: string, has_signature?: boolean}} props.user
 * @param {boolean} props.canEdit Menampilkan tombol aksi hanya untuk pemilik akun.
 * @returns {JSX.Element}
 */
export default function SignatureField({ user, canEdit }) {
  const { t } = useLaravelReactI18n();
  const fileInputRef = useRef(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Tanda tangan baru yang menunggu persetujuan untuk menimpa yang lama.
  const [pendingOverwrite, setPendingOverwrite] = useState(null);
  // Naik setiap tanda tangan berubah. URL berkasnya sama sebelum dan sesudah
  // ditimpa, jadi tanpa penanda ini <img> tidak pernah meminta ulang dan
  // gambar lama tetap tampil sampai halaman dimuat ulang.
  const [signatureVersion, setSignatureVersion] = useState(0);

  // `has_signature`, bukan `signature_file_id`: id berkasnya sengaja
  // disembunyikan dari serialisasi (NFR3), dan keberadaan tanda tangan sudah
  // cukup dijawab boolean.
  const signatureUrl = user.has_signature
    ? route("users.showSignature", user.id)
    : null;
  const previewUrl =
    signatureUrl && signatureVersion
      ? `${signatureUrl}?v=${signatureVersion}`
      : signatureUrl;

  const submit = (blob, source, filename) => {
    setSaving(true);
    router.post(
      route("users.signature", user.id),
      { signature: new File([blob], filename, { type: blob.type }), source },
      {
        forceFormData: true,
        preserveScroll: true,
        reset: ["user", "auth"],
        onSuccess: () => setSignatureVersion(Date.now()),
        onFinish: () => {
          setSaving(false);
          setDrawOpen(false);
        },
      },
    );
  };

  // Menyimpan tanda tangan baru menimpa yang lama tanpa jalan kembali, jadi
  // user diminta setuju dulu. Tanpa tanda tangan lama tidak ada yang ditimpa
  // dan langsung disimpan.
  const requestSubmit = (blob, source, filename) => {
    if (signatureUrl) {
      setPendingOverwrite({ blob, source, filename });
      return;
    }

    submit(blob, source, filename);
  };

  const confirmOverwrite = () => {
    if (!pendingOverwrite) return;

    const { blob, source, filename } = pendingOverwrite;
    setPendingOverwrite(null);
    submit(blob, source, filename);
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    requestSubmit(file, "upload", file.name);
    // Reset supaya memilih berkas yang sama dua kali tetap memicu change.
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("user.signature.title")}</span>

      <div className="flex items-center justify-center w-full h-32 border rounded-md">
        {signatureUrl ? (
          <img
            src={previewUrl}
            alt={t("user.signature.preview_alt")}
            // Berkasnya tinta gelap transparan. Dibalik hanya di tema gelap
            // supaya terbaca di atas kartu gelap; berkas dan hasil cetaknya
            // tidak berubah.
            className="object-contain max-h-full dark:invert"
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
                  onSuccess: () => setSignatureVersion(Date.now()),
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
            onSave={(blob) => requestSubmit(blob, "canvas", "signature.png")}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingOverwrite !== null}
        onOpenChange={(open) => {
          // Menutup tanpa konfirmasi (Batal, Esc, klik di luar) membatalkan
          // penimpaan. Dialog gambar sengaja dibiarkan terbuka supaya
          // gambarnya tidak hilang.
          if (!open) setPendingOverwrite(null);
        }}
      >
        <AlertDialogContent forceAsDialog align="center">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("user.signature.overwrite_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("user.signature.overwrite_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("user.signature.overwrite_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverwrite}>
              {t("user.signature.overwrite_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
