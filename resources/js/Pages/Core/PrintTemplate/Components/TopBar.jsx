import { Code, ExpandIcon, RedoIcon, UndoIcon } from "lucide-react";
import React, { memo, useEffect, useMemo, useState } from "react";

import { Button } from "@/Components/ui/button";
import { useEditor } from "@grapesjs/react";

const TopBar = memo(function TopBar() {
  const editor = useEditor();
  const { UndoManager, Commands } = editor;
  const [, setUpdateCounter] = useState(0);

  const commandButtons = useMemo(() => {
    return [
      {
        id: "core:component-outline",
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
        id: "core:fullscreen",
        icon: <ExpandIcon />,
        options: { target: "#root" },
      },
      {
        id: "core:open-code",
        icon: <Code />,
      },
      {
        id: "core:undo",
        icon: <UndoIcon />,
        disabled: () => !UndoManager.hasUndo(),
      },
      {
        id: "core:redo",
        icon: <RedoIcon />,
        disabled: () => !UndoManager.hasRedo(),
      },
    ];
  }, []);

  useEffect(() => {
    const cmdEvent = "run stop";
    const updateEvent = "update";
    const updateCounter = () => setUpdateCounter((value) => value + 1);
    const onCommand = (id) => {
      commandButtons.find((btn) => btn.id === id) && updateCounter();
    };
    editor.on(cmdEvent, onCommand);
    editor.on(updateEvent, updateCounter);
    return () => {
      editor.off(cmdEvent, onCommand);
      editor.off(updateEvent, updateCounter);
    };
  });
  return (
    <div className="flex gap-3 [&_svg]:size-4!">
      {commandButtons.map(({ id, icon, disabled, options = {} }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="h-8 px-1.5"
          disabled={disabled?.() ?? false}
          onClick={() => {
            Commands.isActive(id)
              ? Commands.stop(id)
              : Commands.run(id, options);
          }}
        >
          {icon}
        </Button>
      ))}
    </div>
  );
});

export default TopBar;
