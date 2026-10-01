import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

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
  const sectionTemplates = usePage().props.sectionTemplates;
  const sections = value ?? [];
  const availableTemplates = templatesForType(sectionTemplates, type);

  const emit = (next) =>
    onValueChange(next.map((section, index) => ({ ...section, order: index })));

  const updateSection = (index, patch) => {
    emit(
      sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    );
  };

  const addSection = () => {
    emit([...sections, { id: generateRandom(8), title: "", content: "" }]);
  };

  const removeSection = (index) => {
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

  return (
    <FormPageContent value="sections" title={t("crm.quotation.sections")}>
      <div className="flex flex-col gap-y-4">
        {sections.map((section, index) => (
          <div
            key={section.id ?? index}
            data-testid="quotation-section"
            className="relative flex flex-col gap-y-4 rounded-md border p-4"
          >
            {!readOnly && (
              <div className="absolute right-2 top-2 flex gap-x-1">
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
              className="pr-28"
            >
              <Input
                value={section.title ?? ""}
                onChange={(e) =>
                  updateSection(index, { title: e.target.value })
                }
                readOnly={readOnly}
              />
            </FormInput>
            <FormInput
              name={`sections.${index}.content`}
              label={t("crm.quotation.columns.section_content")}
              required
            >
              <Textarea
                rows={6}
                value={section.content ?? ""}
                onChange={(e) =>
                  updateSection(index, { content: e.target.value })
                }
                readOnly={readOnly}
              />
            </FormInput>
          </div>
        ))}
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
    </FormPageContent>
  );
}
