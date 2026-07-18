import "@/../css/mention.css";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Mention, MentionsInput } from "@/Components/Mention";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import EmailChipInput from "@/Components/EmailChipInput";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import LoadingIcon from "@/Components/LoadingIcon";
import TiptapEditor from "@/Components/TiptapEditor";
import axios from "axios";
import { gooeyToast } from "@/lib/gooeyToast";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

const EMPTY_PREVIEW = {
  subject: "",
  body: "",
  recipient: null,
  fromAddress: "",
  fromName: "",
  files: [],
  hasGeneratedPdf: false,
  canOfferPdf: false,
  resolvedFields: [],
};

/**
 * Dialog kirim email trigger manual — sepenuhnya editable sebelum
 * dikirim (From Name, To/Cc/Bcc, Subject, Body, attachment). Generate
 * PDF (jika dicentang "Sertakan PDF") terjadi di dalam job pengiriman,
 * BUKAN request terpisah dari dialog ini — mencentang opsi PDF hanya
 * mengubah state lokal `includePdf`.
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.resourceNamePlural Nama route plural, mis. "salesOrders".
 * @param {string} props.documentId
 * @param {string} [props.emailTemplateId]
 * @returns {JSX.Element}
 */
export default function EmailSendDialog({
  open,
  onOpenChange,
  resourceNamePlural,
  documentId,
  emailTemplateId,
}) {
  const { t } = useLaravelReactI18n();
  const editorRef = useRef();
  const fileInputRef = useRef();

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(EMPTY_PREVIEW);
  const [fromNameValue, setFromNameValue] = useState("");
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState("");
  const [bodyJson, setBodyJson] = useState(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [includePdf, setIncludePdf] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    const previewRoute = `${resourceNamePlural}.email.preview`;
    axios
      .get(route(previewRoute, [documentId, emailTemplateId]))
      .then((res) => {
        const data = res.data ?? EMPTY_PREVIEW;
        setPreview(data);
        setFromNameValue(data.fromName ?? "");
        setTo(data.recipient ? [data.recipient] : []);
        setCc([]);
        setBcc([]);
        setSubject(data.subject ?? "");
        setBodyJson(null);
        setBodyHtml(data.body ?? "");
        const preselected = (data.files ?? [])
          .filter((f) => f.isGeneratedPdf)
          .map((f) => f.id);
        setSelectedFileIds(preselected);
        setIncludePdf(false);
      })
      .catch(() => {
        gooeyToast.error(t("core.errors.fetch_failed"));
        setPreview(EMPTY_PREVIEW);
      })
      .finally(() => setLoading(false));
  }, [open, resourceNamePlural, documentId, emailTemplateId, t]);

  // Mention di dialog ini menyisipkan NILAI aktual (bukan token) —
  // sumbernya resolvedFields (nilai sudah di-resolve server), berbeda
  // dari emailTemplates.fields (spec 1) yang hanya mengirim nama field.
  const fetchResolvedFieldsForSubject = useCallback(
    (_search, callback) => {
      callback(
        (preview.resolvedFields ?? []).map((f) => ({
          id: f.value,
          display: f.label,
        })),
      );
    },
    [preview.resolvedFields],
  );

  const mentionSourceForBody = useCallback(
    (query) =>
      Promise.resolve(
        (preview.resolvedFields ?? [])
          .filter((f) =>
            query ? f.label.toLowerCase().includes(query.toLowerCase()) : true,
          )
          .map((f) => ({ id: f.value, label: f.label })),
      ),
    [preview.resolvedFields],
  );

  const toggleFile = (fileId) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId],
    );
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("files[]", file);
    formData.append("name[]", file.name);
    formData.append("isPublic[]", "false");
    const csrfToken =
      document.querySelector('meta[name="csrf-token"]')?.content ?? "";
    axios
      .post(route(`${resourceNamePlural}.addFile`, documentId), formData, {
        headers: {
          "X-CSRF-TOKEN": csrfToken,
          "Content-Type": "multipart/form-data",
        },
      })
      .then(() => {
        // Backend addFile() redirect back tanpa payload file baru — refresh
        // daftar attachment via emailPreview lagi supaya file baru muncul.
        return axios.get(
          route(`${resourceNamePlural}.email.preview`, [
            documentId,
            emailTemplateId,
          ]),
        );
      })
      .then((res) => {
        const data = res.data ?? EMPTY_PREVIEW;
        setPreview((prev) => ({ ...prev, files: data.files }));
        const newFile = (data.files ?? []).find(
          (f) => !selectedFileIds.includes(f.id) && !f.isGeneratedPdf,
        );
        if (newFile) {
          setSelectedFileIds((prev) => [...prev, newFile.id]);
        }
      })
      .catch(() => gooeyToast.error(t("core.errors.fetch_failed")))
      .finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
  };

  const handleSend = () => {
    if (to.length === 0) return;
    setSending(true);
    router.post(
      route(`${resourceNamePlural}.email.send`, documentId),
      {
        to: to[0],
        cc,
        bcc,
        from_name: fromNameValue,
        subject,
        body: bodyHtml,
        fileIds: selectedFileIds,
        include_pdf: includePdf,
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          gooeyToast.success(t("core.emailTemplate.send.queued"));
          onOpenChange(false);
        },
        onError: () => gooeyToast.error(t("core.errors.fetch_failed")),
        onFinish: () => setSending(false),
      },
    );
  };

  const otherFiles = (preview.files ?? []).filter((f) => !f.isGeneratedPdf);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>{t("core.emailTemplate.send.title")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
            <LoadingIcon className="size-4" />
            {t("core.form.loading")}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 grid gap-y-4">
            <FormInput label={t("core.emailTemplate.send.from")}>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {preview.fromAddress}
                </span>
                <Input
                  value={fromNameValue}
                  onValueChange={setFromNameValue}
                  placeholder={t("core.emailTemplate.send.fromNamePlaceholder")}
                  className="flex-1"
                />
              </div>
            </FormInput>

            <FormInput required label={t("core.emailTemplate.send.to")}>
              <EmailChipInput value={to} onValueChange={setTo} />
            </FormInput>

            <FormInput label={t("core.emailTemplate.send.cc")}>
              <EmailChipInput value={cc} onValueChange={setCc} />
            </FormInput>

            <FormInput label={t("core.emailTemplate.send.bcc")}>
              <EmailChipInput value={bcc} onValueChange={setBcc} />
            </FormInput>

            <FormInput required label={t("core.emailTemplate.columns.subject")}>
              <MentionsInput
                singleLine
                value={subject}
                onChange={(_, value) => setSubject(value)}
                className="mentions"
                allowSuggestionsAboveCursor
                autoComplete="off"
              >
                <Mention
                  markup="__id__"
                  trigger="@"
                  data={fetchResolvedFieldsForSubject}
                />
              </MentionsInput>
            </FormInput>

            <div>
              <Label>{t("core.emailTemplate.columns.body")}</Label>
              <TiptapEditor
                ref={editorRef}
                value={bodyJson ?? bodyHtml}
                onValueChange={(json, html) => {
                  setBodyJson(json);
                  setBodyHtml(html);
                }}
                mentionSource={mentionSourceForBody}
              />
            </div>

            <div className="grid gap-y-2">
              <Label>{t("core.emailTemplate.send.attachments")}</Label>
              {otherFiles.map((file) => (
                <FormCheckbox
                  key={file.id}
                  checked={selectedFileIds.includes(file.id)}
                  onCheckedChange={() => toggleFile(file.id)}
                  label={file.name}
                />
              ))}
              {preview.hasGeneratedPdf &&
                (preview.files ?? [])
                  .filter((f) => f.isGeneratedPdf)
                  .map((file) => (
                    <FormCheckbox
                      key={file.id}
                      checked={selectedFileIds.includes(file.id)}
                      onCheckedChange={() => toggleFile(file.id)}
                      label={file.name}
                    />
                  ))}
              {!preview.hasGeneratedPdf && preview.canOfferPdf && (
                <FormCheckbox
                  checked={includePdf}
                  onCheckedChange={setIncludePdf}
                  label={t("core.emailTemplate.send.includePdf")}
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("core.emailTemplate.send.uploadFile")}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-4 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("core.form.cancel")}
          </Button>
          <Button
            type="button"
            disabled={to.length === 0 || sending || loading}
            onClick={handleSend}
          >
            {sending ? (
              <LoadingIcon className="size-4" />
            ) : (
              t("core.emailTemplate.send.button")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
