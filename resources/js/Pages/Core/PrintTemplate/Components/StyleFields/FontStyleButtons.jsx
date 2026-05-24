import React from "react";
import { Button } from "@/Components/ui/button";
import { ButtonGroup } from "@/Components/ui/button-group";
import { cn } from "@/lib/utils";

const FONT_STYLE_OPTIONS = [
  { value: "normal", label: "A", title: "Normal" },
  { value: "italic", label: "I", title: "Italic" },
];

function FontStyleButtons({ prop }) {
  const currentValue = String(prop.getValue?.() || "normal").toLowerCase();
  const normalizedValue = currentValue === "italic" ? "italic" : "normal";

  return (
    <ButtonGroup className="w-full">
      {FONT_STYLE_OPTIONS.map((option) => {
        const isActive = normalizedValue === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "h-8 flex-1 rounded-none px-0",
              option.value === "italic" && "italic",
              !isActive && "bg-muted/20",
            )}
            aria-label={option.title}
            aria-pressed={isActive}
            onClick={() => prop.upValue?.(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

export default FontStyleButtons;
