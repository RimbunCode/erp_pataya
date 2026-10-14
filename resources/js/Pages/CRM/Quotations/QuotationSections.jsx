import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookmarkPlusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import React, { useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import TiptapEditor from "@/Components/TiptapEditor";
import { generateRandom } from "@/lib/utils";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useForm, usePage } from "@inertiajs/react";

const QUOTATION_TYPES = ["spare_part", "new_unit", "rental"];

/**
 * Template blok yang berlaku untuk suatu jenis Quotation. Template tanpa
 * `quotation_type` berlaku untuk semua jenis. Urutan mengikuti kolom `order`.
 * @param {object[]} templates
 * @param {string} type
 * @returns {object[]}
 */
export function templatesForType(templates, type) {
  return (templates ?? [])
    .filter((tpl) => !tpl.quotation_type || tpl.quotation_type === type)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Menyalin isi template ke daftar blok dokumen. Isi DISALIN (pola P3), bukan
 * direferensikan: setelah ini blok menjadi milik dokumen dan boleh diedit tanpa
 * mengubah master. Template yang judulnya sudah ada di dokumen dilewati supaya
 * menekan tombol dua kali tidak menggandakan blok.
 * @param {object[]} sections blok dokumen saat ini
 * @param {object[]} templates template yang akan disalin
 * @returns {object[]} daftar blok baru dengan `order` berurutan
 */
export function copyTemplatesToSections(sections, templates) {
  const current = sections ?? [];
  const existingTitles = new Set(current.map((section) => section.title));
  const copies = templates
    .filter((tpl) => !existingTitles.has(tpl.title))
    .map((tpl) => ({
      id: generateRandom(8),
      title: tpl.title,
      content: tpl.content,
      ...(tpl.content_json !== undefined
        ? { content_json: tpl.content_json }
        : {}),
    }));

  return [...current, ...copies].map((section, index) => ({
    ...section,
    order: index,
  }));
}

export default function QuotationSections({
  value,
  onValueChange,
  readOnly,
  type,
}) {
  const { t } = useLaravelReactI18n();
  const pageSectionTemplates = usePage().props.sectionTemplates;
  const [templatesList, setTemplatesList] = useState(
    () => pageSectionTemplates ?? [],
  );

  useEffect(() => {
    setTemplatesList(pageSectionTemplates ?? []);
  }, [pageSectionTemplates]);

  const sections = value ?? [];
  const availableTemplates = templatesForType(templatesList, type);

  // Pelacakan blok yang diedit inline untuk menawarkan "Simpan sebagai Template Baru"
  const [editedSectionIds, setEditedSectionIds] = useState(() => new Set());
  const [promptSectionIds, setPromptSectionIds] = useState(() => new Set());

  // State dialog "Simpan sebagai Template Baru"
  const [savingSectionIndex, setSavingSectionIndex] = useState(null);
  const {
    data: templateForm,
    setData: setTemplateForm,
    post: postTemplate,
    processing: isSavingTemplate,
    errors: templateErrors,
    clearErrors: clearTemplateErrors,
    reset: resetTemplateForm,
  } = useForm({
    name: "",
    title: "",
    quotation_type: "",
    content: "",
    content_json: null,
  });

  const emit = (next) =>
    onValueChange(next.map((section, index) => ({ ...section, order: index })));

  const markSectionEdited = (sectionId) => {
    if (!sectionId) return;
    setEditedSectionIds((prev) => {
      if (prev.has(sectionId)) return prev;
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  };

  const clearSectionPromptState = (sectionId) => {
    if (!sectionId) return;
    setEditedSectionIds((prev) => {
      if (!prev.has(sectionId)) return prev;
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
    setPromptSectionIds((prev) => {
      if (!prev.has(sectionId)) return prev;
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  };

  const updateSection = (index, patch) => {
    emit(
      sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    );
  };

  const handleTitleChange = (index, title) => {
    const section = sections[index];
    markSectionEdited(section?.id);
    updateSection(index, { title });
  };

  const handleContentChange = (index, patch) => {
    const section = sections[index];
    markSectionEdited(section?.id);
    updateSection(index, patch);
  };

  const handleSectionBlur = (index) => {
    const section = sections[index];
    if (!section?.id || !editedSectionIds.has(section.id)) return;
    const hasTitle = Boolean(section.title?.trim());
    const hasContent = Boolean(section.content?.trim());
    if (!hasTitle || !hasContent) return;

    const matchesExistingTemplate = templatesList.some(
      (tpl) => tpl.title === section.title && tpl.content === section.content,
    );
    if (matchesExistingTemplate) return;

    setPromptSectionIds((prev) => {
      if (prev.has(section.id)) return prev;
      const next = new Set(prev);
      next.add(section.id);
      return next;
    });
  };

  const applyTemplateToSection = (index, templateId) => {
    const tpl = availableTemplates.find((item) => item.id === templateId);
    if (!tpl) return;
    const sectionId = sections[index]?.id;
    clearSectionPromptState(sectionId);
    updateSection(index, {
      title: tpl.title,
      content: tpl.content,
      ...(tpl.content_json !== undefined
        ? { content_json: tpl.content_json }
        : {}),
    });
  };

  const addSection = () => {
    emit([...sections, { id: generateRandom(8), title: "", content: "" }]);
  };

  const removeSection = (index) => {
    const sectionId = sections[index]?.id;
    clearSectionPromptState(sectionId);
    emit(sections.filter((_, i) => i !== index));
  };

  const moveSection = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    emit(next);
  };

  const loadFromTemplates = () => {
    emit(copyTemplatesToSections(sections, availableTemplates));
  };

  const openSaveTemplateDialog = (index) => {
    const section = sections[index];
    if (!section) return;
    const typeLabel = type
      ? t(`crm.quotation.columns.type.options.${type}`)
      : "";
    const suggestedName = section.title
      ? typeLabel && !typeLabel.startsWith("crm.quotation.")
        ? `${section.title} - ${typeLabel}`
        : section.title
      : "";
    setTemplateForm({
      name: suggestedName,
      title: section.title ?? "",
      quotation_type: type ?? "",
      content: section.content,
      content_json: section.content_json ?? null,
    });
    clearTemplateErrors();
    setSavingSectionIndex(index);
  };

  const closeSaveTemplateDialog = () => {
    if (isSavingTemplate) return;
    setSavingSectionIndex(null);
    clearTemplateErrors();
    resetTemplateForm();
  };

  const handleSaveTemplateSubmit = (e) => {
    e.preventDefault();
    if (savingSectionIndex === null) return;
    const targetSection = sections[savingSectionIndex];
    if (!targetSection) return;

    postTemplate(window.route("quotation-section-templates.store"), {
      preserveScroll: true,
      onSuccess: () => {
        clearSectionPromptState(targetSection.id);
        setSavingSectionIndex(null);
        resetTemplateForm();
        toast.success(t("crm.quotation.section_template_saved"));
      },
    });
  };

  return (
    <FormPageContent value="sections" title={t("crm.quotation.sections")}>
      <div className="flex flex-col gap-y-4">
        {sections.map((section, index) => {
          const canSaveAsTemplate =
            Boolean(section.title?.trim()) && Boolean(section.content?.trim());
          const showPrompt =
            !readOnly &&
            section.id &&
            promptSectionIds.has(section.id) &&
            canSaveAsTemplate;

          return (
            <div
              key={section.id ?? index}
              data-testid="quotation-section"
              className="relative flex flex-col gap-y-4 rounded-md border p-4"
            >
              {!readOnly && (
                <div className="absolute right-2 top-2 flex items-center gap-x-1">
                  {availableTemplates.length > 0 && (
                    <select
                      aria-label={t("crm.quotation.select_section_template")}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          applyTemplateToSection(index, e.target.value);
                        }
                      }}
                      className="h-7 max-w-[180px] rounded-md border border-input bg-background px-2 text-xs text-foreground"
                    >
                      <option value="">
                        {t("crm.quotation.select_section_template")}
                      </option>
                      {availableTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name ?? tpl.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("crm.quotation.save_as_template")}
                    title={t("crm.quotation.save_as_template")}
                    disabled={!canSaveAsTemplate}
                    onClick={() => openSaveTemplateDialog(index)}
                  >
                    <BookmarkPlusIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("crm.quotation.move_section_up")}
                    disabled={index === 0}
                    onClick={() => moveSection(index, -1)}
                  >
                    <ArrowUpIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("crm.quotation.move_section_down")}
                    disabled={index === sections.length - 1}
                    onClick={() => moveSection(index, 1)}
                  >
                    <ArrowDownIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("crm.quotation.remove_section")}
                    onClick={() => removeSection(index)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              )}
              <FormInput
                name={`sections.${index}.title`}
                label={t("crm.quotation.columns.section_title")}
                required
                className="pr-36"
              >
                <Input
                  value={section.title ?? ""}
                  onChange={(e) => handleTitleChange(index, e.target.value)}
                  onBlur={() => handleSectionBlur(index)}
                  readOnly={readOnly}
                />
              </FormInput>
              <FormInput
                name={`sections.${index}.content`}
                label={t("crm.quotation.columns.section_content")}
                required
              >
                <TiptapEditor
                  value={section.content_json ?? section.content ?? ""}
                  onValueChange={(json, html) =>
                    handleContentChange(index, {
                      content_json: json,
                      content: html,
                    })
                  }
                  onBlur={() => handleSectionBlur(index)}
                  readOnly={readOnly}
                />
              </FormInput>

              {showPrompt && (
                <div
                  data-testid="save-template-prompt"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {t("crm.quotation.save_section_template_prompt")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openSaveTemplateDialog(index)}
                    >
                      <BookmarkPlusIcon className="size-3.5" />
                      {t("crm.quotation.save_as_template")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => clearSectionPromptState(section.id)}
                    >
                      {t("crm.quotation.dismiss_save_template")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSection}
            >
              <PlusIcon className="size-4" />
              {t("crm.quotation.add_section")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={availableTemplates.length === 0}
              onClick={loadFromTemplates}
            >
              {t("crm.quotation.load_section_templates")}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={savingSectionIndex !== null}
        onOpenChange={(open) => {
          if (!open) closeSaveTemplateDialog();
        }}
      >
        <DialogContent forceAsDialog align="center">
          <DialogHeader>
            <DialogTitle>
              {t("crm.quotation.save_template_dialog_title")}
            </DialogTitle>
            <DialogDescription>
              {t("crm.quotation.save_template_dialog_description")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTemplateSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quotation-template-name">
                {t("crm.quotation.template_name")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quotation-template-name"
                value={templateForm.name}
                placeholder={t("crm.quotation.template_name_placeholder")}
                onChange={(e) => setTemplateForm("name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quotation-template-title">
                {t("crm.quotation.columns.section_title")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quotation-template-title"
                value={templateForm.title}
                onChange={(e) => setTemplateForm("title", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quotation-template-type">
                {t("crm.quotation.columns.type")}
              </Label>
              <select
                id="quotation-template-type"
                value={templateForm.quotation_type}
                onChange={(e) =>
                  setTemplateForm("quotation_type", e.target.value)
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              >
                <option value="">
                  {t("crm.quotation.template_all_types")}
                </option>
                {QUOTATION_TYPES.map((qType) => (
                  <option key={qType} value={qType}>
                    {t(`crm.quotation.columns.type.options.${qType}`)}
                  </option>
                ))}
              </select>
            </div>
            {Object.keys(templateErrors).length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                {Object.values(templateErrors)[0]}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeSaveTemplateDialog}
                disabled={isSavingTemplate}
              >
                {t("crm.quotation.dismiss_save_template")}
              </Button>
              <Button type="submit" disabled={isSavingTemplate}>
                {t("crm.quotation.save_as_template")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </FormPageContent>
  );
}
