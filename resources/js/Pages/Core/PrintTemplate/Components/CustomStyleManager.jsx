import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import StylePropertyField from "./StylePropertyField";
import { parseCssDeclarations, preventBodyDoubleWrap } from "../utils/cssUtils";

const HIDDEN_PROPERTY_IDS = new Set([
  "font-family",
  "text-shadow",
  "box-shadow",
  "transition",
  "transform",
  "background-image",
  "background-repeat",
  "background-position",
  "background-size",
  "background-attachment",
]);

function normalizeSectorName(name = "") {
  const key = name.trim().toLowerCase();

  if (key.includes("typo")) {
    return "Typography";
  }

  if (key.includes("decor") || key.includes("border")) {
    return "Borders & Visual";
  }

  if (key.includes("dimension") || key.includes("size")) {
    return "Layout & Spacing";
  }

  if (key.includes("extra")) {
    return "Advanced";
  }

  return name || "Styles";
}

function componentIdOf(component) {
  return component?.cid ?? component?.getId?.() ?? "unknown";
}

function styleObjectToCssText(styleObject = {}) {
  return Object.entries(styleObject)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(([property, value]) => `${property}: ${value};`)
    .join("\n");
}

// parseCssDeclarations is imported from ../utils/cssUtils
// It normalizes property names to lowercase and handles edge cases

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

  const cssByComponentRef = useRef(new Map());
  const manualKeysByComponentRef = useRef(new Map());

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

  useEffect(() => {
    if (!selectedComponent) {
      setCssDraft("");
      setComponentClasses([]);
      return;
    }

    const componentId = componentIdOf(selectedComponent);
    const cachedDraft = cssByComponentRef.current.get(componentId);

    if (typeof cachedDraft === "string") {
      setCssDraft(cachedDraft);
    } else {
      setCssDraft(styleObjectToCssText(selectedComponent.getStyle?.() || {}));
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
  }, [selectedComponent]);

  const filteredSectors = useMemo(() => {
    return sectors
      .map((sector) => {
        const properties = sector
          .getProperties()
          .filter((property) => !HIDDEN_PROPERTY_IDS.has(property.getId()));

        return {
          id: sector.getId(),
          name: normalizeSectorName(sector.getName()),
          properties,
        };
      })
      .filter((sector) => sector.properties.length > 0);
  }, [sectors]);

  const layoutMode = useMemo(
    () => detectLayoutMode(selectedComponent),
    [selectedComponent],
  );

  const isBodyNode = useMemo(() => {
    if (!selectedComponent) return false;
    const tagName = selectedComponent.get?.("tagName") || "";
    const type = selectedComponent.get?.("type") || "";
    return (
      tagName.toLowerCase() === "body" || type === "wrapper" || type === "body"
    );
  }, [selectedComponent]);

  const refreshClasses = useCallback((component) => {
    if (!component) {
      setComponentClasses([]);
      return;
    }
    const classes = component.getClasses?.() || [];
    setComponentClasses([...classes]);
  }, []);

  const handleAddClass = useCallback(() => {
    const trimmed = newClassName.trim();
    if (!trimmed || !selectedComponent) return;

    selectedComponent.addClass(trimmed);
    setNewClassName("");
    refreshClasses(selectedComponent);
  }, [newClassName, selectedComponent, refreshClasses]);

  const handleRemoveClass = useCallback(
    (className) => {
      if (!selectedComponent) return;
      selectedComponent.removeClass(className);
      refreshClasses(selectedComponent);
    },
    [selectedComponent, refreshClasses],
  );

  const handleClassInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddClass();
      }
    },
    [handleAddClass],
  );

  const applyManualCss = (cssText) => {
    if (!selectedComponent) {
      return;
    }

    const componentId = componentIdOf(selectedComponent);

    // For body node: prevent double-wrapping and store full CSS with selectors
    if (isBodyNode) {
      const cleanCss = preventBodyDoubleWrap(cssText);
      cssByComponentRef.current.set(componentId, cleanCss);
      setCssDraft(cleanCss);

      // Apply clean CSS as declarations to the body component style
      // Parse what we can as declarations for the inline style
      const parsedStyles = parseCssDeclarations(cleanCss);
      const currentStyle = { ...(selectedComponent.getStyle?.() || {}) };
      const previousManualKeys =
        manualKeysByComponentRef.current.get(componentId) || [];

      previousManualKeys.forEach((key) => {
        delete currentStyle[key];
      });

      const nextStyle = {
        ...currentStyle,
        ...parsedStyles,
      };

      selectedComponent.setStyle(nextStyle);
      manualKeysByComponentRef.current.set(
        componentId,
        Object.keys(parsedStyles),
      );
      return;
    }

    const parsedStyles = parseCssDeclarations(cssText);
    const currentStyle = { ...(selectedComponent.getStyle?.() || {}) };
    const previousManualKeys =
      manualKeysByComponentRef.current.get(componentId) || [];

    previousManualKeys.forEach((key) => {
      delete currentStyle[key];
    });

    const nextStyle = {
      ...currentStyle,
      ...parsedStyles,
    };

    selectedComponent.setStyle(nextStyle);
    manualKeysByComponentRef.current.set(
      componentId,
      Object.keys(parsedStyles),
    );
    cssByComponentRef.current.set(componentId, cssText);
    setCssDraft(cssText);
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

      {!filteredSectors.length ? (
        <div className="p-4 text-sm text-muted-foreground">
          Tidak ada properti style yang tersedia untuk komponen ini.
        </div>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={["typography"]}
          className="w-full"
        >
          {filteredSectors.map((sector) => (
            <AccordionItem key={sector.id} value={sector.id}>
              <AccordionTrigger className="px-4 text-sm hover:bg-muted/50">
                {sector.name}
              </AccordionTrigger>
              <AccordionContent className="grid grid-cols-2 gap-2 px-4 pb-4">
                {sector.properties.map((property) => {
                  const hasValue = property.hasValue?.() ?? false;

                  return (
                    <div
                      key={property.getId()}
                      className={cn(
                        "rounded-md border p-2",
                        hasValue
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-border/50",
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
                      <StylePropertyField prop={property} hideLabel />
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
          {t("core/printTemplate.editor.class_manager")}
        </p>
        {!selectedComponent ? (
          <p className="text-xs text-muted-foreground">
            {t("core/printTemplate.editor.select_component")}
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
                placeholder={t("core/printTemplate.editor.add_class")}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                onClick={handleAddClass}
                disabled={!newClassName.trim()}
                aria-label={t("core/printTemplate.editor.add_class")}
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
            {t("core/printTemplate.editor.manual_css")}
          </p>
          {selectedComponent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => setCssModalOpen(true)}
            >
              <Pencil className="h-3 w-3" />
              {t("core/printTemplate.editor.edit_css")}
            </Button>
          )}
        </div>
        {!selectedComponent ? (
          <p className="text-xs text-muted-foreground">
            {t("core/printTemplate.editor.select_component")}
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
          isBodyNode={isBodyNode}
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
