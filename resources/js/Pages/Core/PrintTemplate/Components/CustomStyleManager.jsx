/**
 * Komponen pengelola style kustom untuk editor PrintTemplate.
 * Menampilkan panel style properties (dikelompokkan per section), class manager,
 * dan editor CSS manual untuk komponen yang sedang dipilih di canvas GrapesJS.
 *
 * @module CustomStyleManager
 * @param {Object} props
 * @param {Array} props.sectors - Daftar sector style dari GrapesJS StyleManager,
 *   berisi properti-properti CSS yang tersedia untuk komponen terpilih
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor } from "@grapesjs/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/Components/ui/accordion";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Pencil, Plus, X } from "lucide-react";
import FlexLayoutControls from "./FlexLayoutControls";
import GridLayoutControls from "./GridLayoutControls";
import CSSEditorModal from "./CSSEditorModal";
import {
  buildComponentSelectorTokens,
  filterCssRulesByComponentTokens,
  toKebabCase,
} from "../utils/cssUtils";
import {
  ensureComponentIdRuleFirst,
  hasStyleDeclarations,
  mergeProtectedSelectorStyles,
  normalizeCssInputToSelectorMap,
  resolveComponentPrimarySelector,
  resolveProtectedSelectorsForComponent,
  stripEmptyStyleRules,
} from "../utils/manualCssRuleUtils";
import {
  FIELD_COMPONENT_TYPES,
  STYLE_SECTION_IDS,
  mapSectorsToSections,
  normalizePropertyId,
  resolveFieldComponent,
} from "../utils/styleManagerUtils";
import { getStyleFieldComponent } from "./StyleFields";
// Mengambil ID unik dari komponen GrapesJS (fallback ke "unknown")
function componentIdOf(component) {
  return component?.cid ?? component?.getId?.() ?? "unknown";
}

// Mengkonversi objek style menjadi string CSS text dengan format indentasi
function styleObjectToCssText(styleObject = {}) {
  return Object.entries(styleObject)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(([property, value]) => `  ${toKebabCase(property)}: ${value};`)
    .join("\n");
}

/**
 * Mengelompokkan dan memfilter properti style berdasarkan section.
 * Menyembunyikan properti individual jika composite parent sudah ada
 * (misal: margin-top disembunyikan jika composite margin tersedia).
 *
 * @param {string} sectionId - ID section style (dimension, typography, dll)
 * @param {Array} properties - Daftar properti GrapesJS dari sector
 * @returns {Array} Properti yang sudah difilter untuk ditampilkan
 */
function groupSectionProperties(sectionId, properties) {
  const hasMarginComposite = properties.some(
    (property) =>
      normalizePropertyId(property?.getId?.()) === "margin" &&
      property?.getType?.() === "composite",
  );
  const hasPaddingComposite = properties.some(
    (property) =>
      normalizePropertyId(property?.getId?.()) === "padding" &&
      property?.getType?.() === "composite",
  );
  const hasBorderComposite = properties.some(
    (property) =>
      normalizePropertyId(property?.getId?.()) === "border" &&
      property?.getType?.() === "composite",
  );

  return properties.filter((property) => {
    const propertyId = normalizePropertyId(property?.getId?.());

    if (
      hasMarginComposite &&
      ["margin-top", "margin-right", "margin-bottom", "margin-left"].includes(
        propertyId,
      )
    ) {
      return false;
    }

    if (
      hasPaddingComposite &&
      [
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
      ].includes(propertyId)
    ) {
      return false;
    }

    if (
      hasBorderComposite &&
      ["border-width", "border-style", "border-color"].includes(propertyId)
    ) {
      return false;
    }

    if (sectionId === "advanced" && propertyId === "float") {
      return false;
    }

    return true;
  });
}

/**
 * Mendeteksi mode layout dari komponen yang dipilih.
 * Memeriksa style display dan tipe komponen untuk menentukan apakah
 * komponen menggunakan grid atau flex layout.
 *
 * @param {Object|null} component - Komponen GrapesJS yang dipilih
 * @returns {"grid"|"flex"|null} Mode layout atau null jika tidak terdeteksi
 */
function detectLayoutMode(component) {
  if (!component) {
    return null;
  }

  const style = component.getStyle?.() || {};
  const display = String(style.display || "").toLowerCase();
  const type = String(component.getType?.() || "").toLowerCase();

  if (display.includes("grid") || type === "grid" || type === "subgrid") {
    return "grid";
  }

  if (display.includes("flex")) {
    return "flex";
  }

  return null;
}

function CustomStyleManager({ sectors }) {
  const editor = useEditor();
  const { t } = useLaravelReactI18n();
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [cssDraft, setCssDraft] = useState("");
  const [cssModalOpen, setCssModalOpen] = useState(false);
  const [componentClasses, setComponentClasses] = useState([]);
  const [newClassName, setNewClassName] = useState("");

  // Mengambil semua CSS rules dari editor dan menghapus rule kosong
  const getCssRules = () => {
    const css = editor.Css;
    return stripEmptyStyleRules(
      css.getRules().map((rule) => {
        return {
          selectors: rule.getSelectorsString(),
          style: rule.getStyle(),
        };
      }),
    );
  };
  // Mengkonversi array CSS rules menjadi string CSS yang bisa ditampilkan
  const cssRulesToString = (cssRules) => {
    cssRules ??= getCssRules();
    let result = "";
    cssRules.forEach((rule) => {
      result += `${rule.selectors} {\n${styleObjectToCssText(rule.style)}\n}\n\n`;
    });
    return result;
  };

  // Mengambil CSS rules yang relevan untuk komponen tertentu berdasarkan selector tokens
  const getCssByComponent = (component) => {
    if (!component) {
      return getCssRules();
    }

    const classes = (component.getClasses?.() || []).map((cls) =>
      typeof cls === "string"
        ? cls
        : cls.get?.("name") || cls.id || String(cls),
    );

    const componentDescriptor = {
      id: component.getId?.() || component.get?.("id") || "",
      tagName: component.get?.("tagName") || "",
      classes,
      attributes: component.getAttributes?.() || {},
      selectorsString: component.getSelectorsString?.() || "",
    };

    const componentTokens = buildComponentSelectorTokens(componentDescriptor);
    return filterCssRulesByComponentTokens(getCssRules(), componentTokens);
  };

  // useEffect: Sinkronisasi state selectedComponent dengan komponen yang dipilih di editor.
  // Dependency: [editor] — dipicu ulang jika instance editor berubah.
  // Diperlukan untuk mendengarkan event selected/deselected/update dari GrapesJS
  // dan memperbarui state lokal agar UI panel style selalu sinkron.
  useEffect(() => {
    const refreshSelection = () => {
      setSelectedComponent(editor.getSelected() || null);
    };

    editor.on("component:selected", refreshSelection);
    editor.on("component:deselected", refreshSelection);
    editor.on("component:update", refreshSelection);

    refreshSelection();

    return () => {
      editor.off("component:selected", refreshSelection);
      editor.off("component:deselected", refreshSelection);
      editor.off("component:update", refreshSelection);
    };
  }, [editor]);
  // useMemo: Mendeteksi apakah komponen yang dipilih adalah node body/wrapper.
  // Dependency: [selectedComponent] — dihitung ulang saat komponen berubah.
  const isBodyNode = useMemo(() => {
    if (!selectedComponent) return false;
    const tagName = selectedComponent.get?.("tagName") || "";
    const type = selectedComponent.get?.("type") || "";
    return (
      tagName.toLowerCase() === "body" || type === "wrapper" || type === "body"
    );
  }, [selectedComponent]);
  // useEffect: Memperbarui cssDraft dan componentClasses saat komponen berubah.
  // Dependency: [selectedComponent, isBodyNode] — dipicu oleh perubahan komponen terpilih atau status body node.
  // Diperlukan agar preview CSS dan daftar class selalu mencerminkan komponen aktif.
  // Jika body node, tampilkan semua CSS. Jika komponen biasa, filter CSS yang relevan saja.
  useEffect(() => {
    if (!selectedComponent) {
      setCssDraft(cssRulesToString());
      setComponentClasses([]);
      return;
    } else if (isBodyNode) {
      setCssDraft(cssRulesToString());
      return;
    }
    const componentId = String(selectedComponent.getId?.() || "").trim();
    const matchedCssRules = getCssByComponent(selectedComponent);
    if (matchedCssRules.length > 0) {
      const initialRules = ensureComponentIdRuleFirst(
        matchedCssRules,
        componentId,
      );
      setCssDraft(cssRulesToString(initialRules));
    } else {
      const fallbackSelector =
        componentId ||
        selectedComponent.getSelectorsString?.() ||
        selectedComponent.get?.("tagName") ||
        "*";

      setCssDraft(
        cssRulesToString([
          {
            selectors: componentId ? `#${componentId}` : fallbackSelector,
            style: selectedComponent.getStyle?.() || {},
          },
        ]),
      );
    }

    // Refresh classes
    const classes = selectedComponent.getClasses?.() || [];
    setComponentClasses(
      classes.map((cls) =>
        typeof cls === "string"
          ? cls
          : cls.get?.("name") || cls.id || String(cls),
      ),
    );
  }, [selectedComponent, isBodyNode]);

  // useMemo: Memetakan sectors ke section items dan memfilter properti per section.
  // Dependency: [sectors] — dihitung ulang saat sectors dari GrapesJS berubah.
  const sectionItems = useMemo(() => {
    const mappedSections = mapSectorsToSections(sectors);

    return STYLE_SECTION_IDS.map((sectionId) => mappedSections[sectionId])
      .map((section) => ({
        ...section,
        properties: groupSectionProperties(section.id, section.properties),
      }))
      .filter((section) => section.properties.length > 0);
  }, [sectors]);

  // useMemo: Mendeteksi mode layout (grid/flex) dari komponen yang dipilih.
  // Dependency: [selectedComponent] — dihitung ulang saat komponen berubah.
  const layoutMode = useMemo(
    () => detectLayoutMode(selectedComponent),
    [selectedComponent],
  );
  // useMemo: Menghitung daftar selector CSS yang dilindungi (tidak boleh dihapus user).
  // Dependency: [selectedComponent, isBodyNode, cssDraft] — dihitung ulang saat komponen,
  // status body, atau draft CSS berubah.
  const manualCssProtectedSelectors = useMemo(() => {
    if (!selectedComponent || isBodyNode) {
      return [];
    }

    return [
      ...resolveProtectedSelectorsForComponent(
        selectedComponent,
        getCssRules(),
      ),
    ];
  }, [selectedComponent, isBodyNode, cssDraft]);

  // useCallback: Memperbarui daftar class CSS dari komponen yang dipilih.
  // Dependency: [] — fungsi stabil, tidak bergantung pada state eksternal.
  // Diperlukan untuk menyinkronkan state componentClasses dengan class aktual di komponen.
  const refreshClasses = useCallback((component) => {
    if (!component) {
      setComponentClasses([]);
      return;
    }
    const classes = component.getClasses?.() || [];
    setComponentClasses([...classes]);
  }, []);

  // useCallback: Menambahkan class baru ke komponen yang dipilih.
  // Dependency: [newClassName, selectedComponent, refreshClasses] — dibuat ulang saat input atau komponen berubah.
  // Diperlukan agar class yang ditambahkan selalu mengacu pada komponen dan input terkini.
  const handleAddClass = useCallback(() => {
    const trimmed = newClassName.trim();
    if (!trimmed || !selectedComponent) return;

    selectedComponent.addClass(trimmed);
    setNewClassName("");
    refreshClasses(selectedComponent);
  }, [newClassName, selectedComponent, refreshClasses]);

  // useCallback: Menghapus class dari komponen yang dipilih.
  // Dependency: [selectedComponent, refreshClasses] — dibuat ulang saat komponen berubah.
  // Diperlukan agar penghapusan class selalu mengacu pada komponen aktif.
  const handleRemoveClass = useCallback(
    (className) => {
      if (!selectedComponent) return;
      selectedComponent.removeClass(className);
      refreshClasses(selectedComponent);
    },
    [selectedComponent, refreshClasses],
  );

  // useCallback: Menangani keydown Enter pada input class untuk trigger penambahan.
  // Dependency: [handleAddClass] — dibuat ulang saat handleAddClass berubah.
  // Diperlukan agar user bisa menambah class dengan menekan Enter tanpa klik tombol.
  const handleClassInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddClass();
      }
    },
    [handleAddClass],
  );

  // Handler: Menerapkan CSS manual yang diedit user ke editor GrapesJS.
  // Alur eksekusi:
  //   1. Parse input CSS menjadi selector map
  //   2. Tentukan selector mana yang akan di-replace berdasarkan draft sebelumnya
  //   3. Lindungi selector yang protected (tidak boleh dihapus)
  //   4. Hapus semua rules lama yang termasuk dalam scope replace
  //   5. Terapkan rules baru dari merged selector map
  // Efek samping: memperbarui cssDraft state dan CSS rules di editor GrapesJS.
  const applyManualCss = (cssText) => {
    const css = editor.Css;
    const currentRules = getCssRules();
    const primarySelector = resolveComponentPrimarySelector(selectedComponent);
    const nextSelectorMap = normalizeCssInputToSelectorMap(
      cssText,
      primarySelector,
    );

    const previousSelectorMap = normalizeCssInputToSelectorMap(
      cssDraft,
      primarySelector,
    );

    const selectorsToReplace = isBodyNode
      ? new Set(currentRules.map((rule) => rule.selectors))
      : new Set(Object.keys(previousSelectorMap));

    if (!isBodyNode && selectorsToReplace.size === 0 && selectedComponent) {
      getCssByComponent(selectedComponent).forEach((rule) => {
        selectorsToReplace.add(rule.selectors);
      });
    }

    const protectedSelectorSet = resolveProtectedSelectorsForComponent(
      selectedComponent,
      currentRules,
    );
    const mergedNextSelectorMap = mergeProtectedSelectorStyles(
      nextSelectorMap,
      currentRules,
      protectedSelectorSet,
    );
    const nextSelectors = new Set(
      Object.keys(mergedNextSelectorMap)
        .map((selector) => String(selector || "").trim())
        .filter(Boolean),
    );

    const effectiveSelectorsToReplace = new Set(
      [...selectorsToReplace]
        .map((selector) => String(selector || "").trim())
        .filter(Boolean)
        .filter((selector) => {
          if (!protectedSelectorSet.has(selector)) {
            return true;
          }

          // Selector default komponen tidak boleh hilang.
          // User tetap boleh ubah jika selector itu ditulis ulang di input terbaru.
          return nextSelectors.has(selector);
        }),
    );

    const preservedRules = currentRules.filter(
      (rule) =>
        !effectiveSelectorsToReplace.has(String(rule.selectors || "").trim()),
    );

    css.clear();
    preservedRules.forEach((rule) => {
      css.setRule(rule.selectors, rule.style);
    });

    Object.entries(mergedNextSelectorMap).forEach(([selector, style]) => {
      if (!selector?.trim()) {
        return;
      }

      if (!hasStyleDeclarations(style)) {
        return;
      }

      css.setRule(selector.trim(), style);
    });

    if (isBodyNode) {
      setCssDraft(cssRulesToString(getCssRules()));
      return;
    }

    if (selectedComponent) {
      const updatedRules = getCssByComponent(selectedComponent);
      setCssDraft(cssRulesToString(updatedRules));
      return;
    }

    setCssDraft(cssRulesToString(getCssRules()));
  };

  return (
    <div className="space-y-3 text-left">
      {layoutMode && selectedComponent && (
        <div className="rounded-md border border-border/60 bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Layout
          </p>
          {layoutMode === "grid" ? (
            <GridLayoutControls component={selectedComponent} />
          ) : (
            <FlexLayoutControls component={selectedComponent} />
          )}
        </div>
      )}

      {!sectionItems.length ? (
        <div className="p-4 text-sm text-muted-foreground">
          Tidak ada properti style yang tersedia untuk komponen ini.
        </div>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={["dimension", "typography"]}
          className="w-full"
        >
          {sectionItems.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="px-4 text-sm hover:bg-muted/50">
                {section.label}
              </AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 px-4 pb-4">
                {section.properties.map((property, index) => {
                  const propertyId = property.getId?.() || `property-${index}`;
                  const hasValue = property.hasValue?.() ?? false;
                  const fieldType = resolveFieldComponent(property, section.id);
                  const FieldComponent = getStyleFieldComponent(fieldType);
                  const isGroupField = [
                    FIELD_COMPONENT_TYPES.COMPOSITE_SPACING,
                    FIELD_COMPONENT_TYPES.BORDER_FIELD,
                    FIELD_COMPONENT_TYPES.TEXT_ALIGN_BUTTONS,
                    FIELD_COMPONENT_TYPES.TEXT_DECORATION_BUTTONS,
                    FIELD_COMPONENT_TYPES.FONT_STYLE_BUTTONS,
                    FIELD_COMPONENT_TYPES.LEGACY_FIELD,
                  ].includes(fieldType);

                  return (
                    <div
                      key={`${section.id}:${propertyId}:${index}`}
                      className={cn(
                        "rounded-md border p-2.5",
                        hasValue
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-border/50",
                        isGroupField && "bg-muted/20",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {property.getLabel()}
                        </span>
                        {hasValue && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <FieldComponent prop={property} />
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <div className="rounded-md border border-border/60 bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("core.printTemplate.editor.class_manager")}
        </p>
        {!selectedComponent ? (
          <p className="text-xs text-muted-foreground">
            {t("core.printTemplate.editor.select_component")}
          </p>
        ) : (
          <div className="space-y-2">
            {componentClasses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {componentClasses.map((cls) => (
                  <span
                    key={cls}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    {cls}
                    <button
                      type="button"
                      onClick={() => handleRemoveClass(cls)}
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive"
                      aria-label={`Remove class ${cls}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Input
                value={newClassName}
                onValueChange={setNewClassName}
                onKeyDown={handleClassInputKeyDown}
                placeholder={t("core.printTemplate.editor.add_class")}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                onClick={handleAddClass}
                disabled={!newClassName.trim()}
                aria-label={t("core.printTemplate.editor.add_class")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border/60 bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("core.printTemplate.editor.manual_css")}
          </p>
          {selectedComponent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => setCssModalOpen(true)}
            >
              <Pencil className="h-3 w-3" />
              {t("core.printTemplate.editor.edit_css")}
            </Button>
          )}
        </div>
        {!selectedComponent ? (
          <p className="text-xs text-muted-foreground">
            {t("core.printTemplate.editor.select_component")}
          </p>
        ) : (
          <div className="rounded-md border border-border/40 bg-muted/30 p-2">
            {cssDraft.trim() ? (
              <pre className="whitespace-pre-wrap text-xs font-mono text-foreground/80 max-h-[120px] overflow-y-auto">
                {cssDraft}
              </pre>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                No manual CSS applied.
              </p>
            )}
          </div>
        )}

        <CSSEditorModal
          open={cssModalOpen}
          onOpenChange={setCssModalOpen}
          initialCSS={cssDraft}
          protectedSelectors={manualCssProtectedSelectors}
          componentId={
            selectedComponent ? componentIdOf(selectedComponent) : "global"
          }
          onSave={applyManualCss}
        />
      </div>
    </div>
  );
}

export default CustomStyleManager;
