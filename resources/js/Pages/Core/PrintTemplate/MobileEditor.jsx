import { Canvas, useEditor } from "@grapesjs/react";
import React, { useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Eye,
  Loader2Icon,
  RedoIcon,
  SaveIcon,
  UndoIcon,
} from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { cn } from "@/lib/utils";

const DEFAULT_TEXT_COLOR = "#111827";
const DEFAULT_TEXT_ALIGN = "left";

const ALIGNMENT_OPTIONS = [
  {
    value: "left",
    icon: AlignLeft,
    labelKey: "core.printTemplate.editor.align_left",
  },
  {
    value: "center",
    icon: AlignCenter,
    labelKey: "core.printTemplate.editor.align_center",
  },
  {
    value: "right",
    icon: AlignRight,
    labelKey: "core.printTemplate.editor.align_right",
  },
  {
    value: "justify",
    icon: AlignJustify,
    labelKey: "core.printTemplate.editor.align_justify",
  },
];

const EDITABLE_TAGS = new Set([
  "p",
  "span",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "td",
  "th",
  "li",
  "a",
]);

function normalizeHexColor(value) {
  if (typeof value !== "string") {
    return DEFAULT_TEXT_COLOR;
  }

  const color = value.trim();
  if (!color.startsWith("#")) {
    return DEFAULT_TEXT_COLOR;
  }

  if (/^#[\da-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  if (/^#[\da-fA-F]{6}$/.test(color)) {
    return color;
  }

  return DEFAULT_TEXT_COLOR;
}

function normalizeFontSize(value) {
  if (typeof value !== "string") {
    return "";
  }

  const match = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (!match) {
    return "";
  }

  return match[1];
}

function isTextComponent(component) {
  if (!component) {
    return false;
  }

  const type = component.getType?.();
  if (type === "text" || type === "textnode") {
    return true;
  }

  const tagName = component.get?.("tagName");
  if (typeof tagName !== "string") {
    return false;
  }

  return EDITABLE_TAGS.has(tagName.toLowerCase());
}

function resolveEditableComponent(component) {
  let current = component;

  while (current) {
    if (isTextComponent(current)) {
      return current;
    }

    current = current.parent?.();
  }

  return null;
}

function MobileEditor({ canvasClassName, canvasStyle }) {
  const { t } = useLaravelReactI18n();
  const editor = useEditor();
  const { UndoManager, Commands } = editor;

  const [selectedComponent, setSelectedComponent] = useState(null);
  const [textContent, setTextContent] = useState("");
  const [fontSize, setFontSize] = useState("");
  const [fontColor, setFontColor] = useState(DEFAULT_TEXT_COLOR);
  const [textAlign, setTextAlign] = useState(DEFAULT_TEXT_ALIGN);
  const [isSaving, setIsSaving] = useState(false);
  const [, setUpdateCounter] = useState(0);

  const hasSelectedTextComponent = Boolean(selectedComponent);

  const canUndo = useMemo(() => UndoManager.hasUndo(), [UndoManager]);
  const canRedo = useMemo(() => UndoManager.hasRedo(), [UndoManager]);

  useEffect(() => {
    const refreshEditorState = () => {
      setUpdateCounter((value) => value + 1);
    };

    const onSaveStart = () => {
      setIsSaving(true);
    };

    const onSaveFinish = () => {
      setIsSaving(false);
    };

    editor.on("run stop update", refreshEditorState);
    editor.on("template:save-start", onSaveStart);
    editor.on("template:save-finish", onSaveFinish);

    return () => {
      editor.off("run stop update", refreshEditorState);
      editor.off("template:save-start", onSaveStart);
      editor.off("template:save-finish", onSaveFinish);
    };
  }, [editor]);

  useEffect(() => {
    const updateSelection = (component) => {
      const selected = component || editor.getSelected?.();
      const editableComponent = resolveEditableComponent(selected);

      setSelectedComponent(editableComponent || null);

      if (!editableComponent) {
        setTextContent("");
        setFontSize("");
        setFontColor(DEFAULT_TEXT_COLOR);
        setTextAlign(DEFAULT_TEXT_ALIGN);
        return;
      }

      const content = editableComponent.get?.("content");
      const style = editableComponent.getStyle?.() || {};
      const selectedTextAlign =
        typeof style["text-align"] === "string" && style["text-align"]
          ? style["text-align"]
          : DEFAULT_TEXT_ALIGN;

      setTextContent(typeof content === "string" ? content : "");
      setFontSize(normalizeFontSize(style["font-size"]));
      setFontColor(normalizeHexColor(style.color));
      setTextAlign(selectedTextAlign);
    };

    editor.on("component:selected", updateSelection);
    editor.on("component:deselected", updateSelection);

    updateSelection();

    return () => {
      editor.off("component:selected", updateSelection);
      editor.off("component:deselected", updateSelection);
    };
  }, [editor]);

  const applyTextContent = (value) => {
    setTextContent(value);

    if (!selectedComponent) {
      return;
    }

    selectedComponent.set("content", value);
    editor.trigger("component:update", selectedComponent);
  };

  const applyFontSize = (value) => {
    setFontSize(value);

    if (!selectedComponent) {
      return;
    }

    const trimmedValue = value.trim();
    const nextStyle = {};

    if (!trimmedValue) {
      nextStyle["font-size"] = "";
      selectedComponent.addStyle(nextStyle);
      editor.trigger("component:update", selectedComponent);
      return;
    }

    const parsedFontSize = Number.parseFloat(trimmedValue);
    if (!Number.isFinite(parsedFontSize) || parsedFontSize <= 0) {
      return;
    }

    nextStyle["font-size"] = `${parsedFontSize}px`;
    selectedComponent.addStyle(nextStyle);
    editor.trigger("component:update", selectedComponent);
  };

  const applyTextColor = (value) => {
    const normalizedColor = normalizeHexColor(value);
    setFontColor(normalizedColor);

    if (!selectedComponent) {
      return;
    }

    selectedComponent.addStyle({
      color: normalizedColor,
    });
    editor.trigger("component:update", selectedComponent);
  };

  const applyTextAlign = (value) => {
    setTextAlign(value);

    if (!selectedComponent) {
      return;
    }

    selectedComponent.addStyle({
      "text-align": value,
    });
    editor.trigger("component:update", selectedComponent);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-2 shadow-xs">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isSaving}
            onClick={() => Commands.run("core:save-template")}
            className="h-9"
          >
            {isSaving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {t("core.printTemplate.editor.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => Commands.run("core:preview-template")}
            className="h-9"
          >
            <Eye />
            {t("core.printTemplate.editor.preview")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={!canUndo}
            onClick={() => Commands.run("core:undo")}
            className="h-9"
          >
            <UndoIcon />
            {t("core.printTemplate.editor.undo")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={!canRedo}
            onClick={() => Commands.run("core:redo")}
            className="h-9"
          >
            <RedoIcon />
            {t("core.printTemplate.editor.redo")}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-border bg-muted/20 p-2 touch-pan-y">
        <Canvas className={canvasClassName} style={canvasStyle} />
      </div>

      <div className="max-h-[42vh] overflow-auto rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="space-y-3 text-left">
          <div>
            <h3 className="text-sm font-semibold">
              {t("core.printTemplate.editor.mobile_editor_title")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("core.printTemplate.editor.mobile_editor_desc")}
            </p>
          </div>

          {!hasSelectedTextComponent ? (
            <div className="rounded-md border border-dashed border-muted-foreground/40 p-3 text-xs text-muted-foreground">
              {t("core.printTemplate.editor.no_text_selected")}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {t("core.printTemplate.editor.text")}
                </Label>
                <Textarea
                  rows={3}
                  value={textContent}
                  onValueChange={applyTextContent}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {t("core.printTemplate.editor.font_size")}
                  </Label>
                  <Input
                    value={fontSize}
                    onChange={(event) => applyFontSize(event.target.value)}
                    inputMode="decimal"
                    placeholder="12"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {t("core.printTemplate.editor.color")}
                  </Label>
                  <Input
                    type="color"
                    value={fontColor}
                    onChange={(event) => applyTextColor(event.target.value)}
                    className="h-8 rounded-md border border-input bg-muted p-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  {t("core.printTemplate.editor.alignment")}
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {ALIGNMENT_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={textAlign === value ? "secondary" : "outline"}
                      size="md"
                      aria-label={t(labelKey)}
                      onClick={() => applyTextAlign(value)}
                      className={cn("h-8 px-2")}
                    >
                      <Icon />
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MobileEditor;
