import "@/../css/mention.css";

import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { Mention, MentionsInput } from "@/Components/Mention";
import { useCallback, useMemo, useRef } from "react";

import { Button } from "@/Components/ui/button";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import PermissionLinkModel from "../PermissionLinkModel";
import TiptapEditor from "@/Components/TiptapEditor";
import axios from "axios";
import { gooeyToast } from "@/lib/gooeyToast";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const editorRef = useRef();

  const fetchFieldColumns = useCallback(() => {
    const modelClass = data?.permission?.model;
    if (!modelClass) return Promise.resolve([]);
    return axios
      .get(route("emailTemplates.fields"), { params: { model: modelClass } })
      .then((res) => res.data ?? [])
      .catch(() => []);
  }, [data?.permission?.model]);

  // Subject (react-mentions): id sudah berupa accessor arrow final ("doc->name")
  // agar markup "{{ $__id__ }}" langsung valid tanpa transform lanjutan.
  const fetchFields = useCallback(
    (_search, callback) => {
      fetchFieldColumns().then((columns) => {
        callback(
          columns.map((col) => ({
            id: `doc->${col.name}`,
            display: col.titleTrans ? t(col.titleTrans) : col.name,
          })),
        );
      });
    },
    [fetchFieldColumns, t],
  );

  // Body (TiptapEditor): id berupa dot-path ("doc.name"), dikonversi ke token
  // arrow oleh dotPathToMergeTagToken() saat renderHTML (lihat TiptapEditor.jsx).
  // Filter dicocokkan terhadap label (teks yang user lihat), fallback ke nama
  // kolom mentah untuk power-user yang mengetik nama field asli.
  const mentionSourceForBody = useMemo(
    () => (query) =>
      fetchFieldColumns().then((columns) =>
        columns
          .map((col) => ({
            id: `doc.${col.name}`,
            label: col.titleTrans ? t(col.titleTrans) : col.name,
            name: col.name,
          }))
          .filter((item) =>
            query
              ? item.label.toLowerCase().includes(query.toLowerCase()) ||
                item.name.toLowerCase().includes(query.toLowerCase())
              : true,
          ),
      ),
    [fetchFieldColumns, t],
  );

  const handleBodyChange = useCallback(
    (json, html) => {
      setData((prev) => ({ ...prev, body_json: json, body_html: html }));
    },
    [setData],
  );

  const handleTestSend = useCallback(() => {
    if (!data?.id) return;
    router.post(
      route("emailTemplates.testSend", data.id),
      {},
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () =>
          gooeyToast.success(t("core.emailTemplate.testSend.success")),
      },
    );
  }, [data?.id, t]);

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            name="model"
            required
            label={t("core.emailTemplate.columns.model")}
          >
            <PermissionLinkModel
              required={true}
              placeholder={t("core.emailTemplate.columns.model.placeholder")}
              value={data.permission}
              onValueChange={(val) =>
                setData((prev) => ({
                  ...prev,
                  permission: val,
                  model: val?.model,
                }))
              }
            />
          </FormInput>
          <FormInput
            name="name"
            required
            label={t("core.emailTemplate.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onValueChange={(e) => setData("name", e)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.is_default}
            onCheckedChange={(val) => setData("is_default", val)}
            label={t("core.emailTemplate.columns.is_default")}
          />
        </div>
      </FormPageContent>

      <FormPageContent
        title={t("core.emailTemplate.columns.subject")}
        value="detail"
      >
        <FormInput
          name="subject"
          required
          label={t("core.emailTemplate.columns.subject")}
        >
          <MentionsInput
            singleLine
            value={data?.subject ?? ""}
            onChange={(_, value) => setData("subject", value)}
            className="mentions"
            allowSuggestionsAboveCursor
            autoComplete="off"
            disabled={!data?.permission?.model}
            placeholder={t("core.emailTemplate.columns.model.placeholder")}
          >
            <Mention
              markup="{{ $__id__ }}"
              trigger="@"
              data={fetchFields}
              displayTransform={(id) => `{{ $${id} }}`}
            />
          </MentionsInput>
        </FormInput>
      </FormPageContent>

      <FormPageContent
        title={t("core.emailTemplate.columns.body")}
        value="detail"
      >
        <div className="flex items-center justify-between mb-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!data?.id}
            onClick={handleTestSend}
          >
            {t("core.emailTemplate.testSend.button")}
          </Button>
        </div>
        {data?.permission?.model ? (
          <TiptapEditor
            ref={editorRef}
            value={data?.body_json}
            onValueChange={handleBodyChange}
            mentionSource={mentionSourceForBody}
            mentionRenderMode="mergeTag"
          />
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-4 border border-dashed rounded-lg">
            {t("core.emailTemplate.columns.model.placeholder")}
          </div>
        )}
      </FormPageContent>
    </>
  );
}
