import {
  Code,
  Eye,
  Loader2Icon,
  RedoIcon,
  SaveIcon,
  UndoIcon,
} from "lucide-react";
import React, { memo, useEffect, useMemo, useState } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { Button } from "@/Components/ui/button";
import { Kbd, KbdGroup } from "@/Components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { useEditor } from "@grapesjs/react";
import SaveStatusBadge from "./SaveStatusBadge";

const TopBar = memo(function TopBar() {
  const { t } = useLaravelReactI18n();
  const editor = useEditor();
  const { UndoManager, Commands } = editor;
  const [isSaving, setIsSaving] = useState(false);
  const [, setUpdateCounter] = useState(0);

  const renderShortcut = (shortcut = []) => {
    if (!shortcut.length) {
      return null;
    }

    return (
      <KbdGroup>
        {shortcut.map((key, index) => (
          <React.Fragment key={`${key}-${index}`}>
            {index > 0 && <span>+</span>}
            <Kbd>{key}</Kbd>
          </React.Fragment>
        ))}
      </KbdGroup>
    );
  };

  const commandButtons = useMemo(() => {
    return [
      {
        id: "core:save-template",
        label: t("core.printTemplate.editor.save"),
        icon: isSaving ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <SaveIcon />
        ),
        shortcut: ["Ctrl/Cmd", "S"],
        disabled: () => isSaving,
        variant: "primary",
      },
      {
        id: "core:undo",
        label: t("core.printTemplate.editor.undo"),
        icon: <UndoIcon />,
        shortcut: ["Ctrl/Cmd", "Z"],
        disabled: () => !UndoManager.hasUndo(),
      },
      {
        id: "core:redo",
        label: t("core.printTemplate.editor.redo"),
        icon: <RedoIcon />,
        shortcut: ["Ctrl/Cmd", "Shift", "Z"],
        disabled: () => !UndoManager.hasRedo(),
      },
      {
        id: "core:preview-template",
        label: t("core.printTemplate.editor.preview"),
        icon: <Eye />,
        shortcut: ["Ctrl/Cmd", "Shift", "P"],
      },
      {
        id: "core:component-outline",
        label: t("core.printTemplate.editor.outline"),
        toggle: true,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <path
              fill="currentColor"
              d="M5.012 2.659a.77.77 0 0 1-.652.871a.98.98 0 0 0-.83.83a.77.77 0 0 1-1.524-.22a2.52 2.52 0 0 1 2.135-2.134a.77.77 0 0 1 .871.653M3.53 11.623a.77.77 0 1 0-1.524.219a2.52 2.52 0 0 0 2.135 2.134a.77.77 0 0 0 .219-1.524a.98.98 0 0 1-.83-.83m9.794-.653c.42.06.713.45.652.872a2.525 2.525 0 0 1-2.134 2.134a.77.77 0 0 1-.22-1.524a.985.985 0 0 0 .83-.83a.77.77 0 0 1 .872-.652m-1.482-8.964a.77.77 0 0 0-.22 1.524a.98.98 0 0 1 .83.83a.77.77 0 1 0 1.524-.22a2.525 2.525 0 0 0-2.134-2.134M6.5 2.75A.75.75 0 0 1 7.25 2h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75m-4.5 6a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-1.5 0zm4.5 4.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75m6-4.5a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-1.5 0z"
            ></path>
          </svg>
        ),
      },
      {
        id: "core:open-code",
        label: t("core.printTemplate.editor.code"),
        toggle: true,
        icon: <Code />,
      },
    ];
  }, [UndoManager, isSaving, t]);

  useEffect(() => {
    const cmdEvent = "run stop";
    const updateEvent = "update";
    const updateCounter = () => setUpdateCounter((value) => value + 1);
    const onCommand = () => updateCounter();
    const onSaveStart = () => setIsSaving(true);
    const onSaveFinish = () => setIsSaving(false);

    editor.on(cmdEvent, onCommand);
    editor.on(updateEvent, updateCounter);
    editor.on("template:save-start", onSaveStart);
    editor.on("template:save-finish", onSaveFinish);

    return () => {
      editor.off(cmdEvent, onCommand);
      editor.off(updateEvent, updateCounter);
      editor.off("template:save-start", onSaveStart);
      editor.off("template:save-finish", onSaveFinish);
    };
  }, [editor]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-2 [&_svg]:size-4!">
        {commandButtons.map(
          ({
            id,
            icon,
            label,
            disabled,
            options = {},
            shortcut = [],
            toggle = false,
            variant = "outline",
          }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={Commands.isActive(id) ? "secondary" : variant}
                  size="sm"
                  className="h-8 px-2.5 gap-1.5"
                  aria-label={label}
                  disabled={disabled?.() ?? false}
                  onClick={() => {
                    if (toggle) {
                      Commands.isActive(id)
                        ? Commands.stop(id)
                        : Commands.run(id, options);
                      return;
                    }

                    Commands.run(id, options);
                  }}
                >
                  {icon}
                  <span>{label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>{label}</span>
                  {renderShortcut(shortcut)}
                </div>
              </TooltipContent>
            </Tooltip>
          ),
        )}
        <SaveStatusBadge />
      </div>
    </TooltipProvider>
  );
});

export default TopBar;
