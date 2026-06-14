import React from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { ButtonGroup } from "@/Components/ui/button-group";
import { cn } from "@/lib/utils";

const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
  { value: "justify", label: "Align justify", icon: AlignJustify },
];

function TextAlignButtons({ prop }) {
  const currentValue = String(prop.getValue?.() || "").toLowerCase();

  return (
    <ButtonGroup className="w-full">
      {ALIGN_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = currentValue === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "h-8 flex-1 rounded-none px-0",
              !isActive && "bg-muted/20",
            )}
            aria-label={option.label}
            aria-pressed={isActive}
            onClick={() => prop.upValue?.(option.value)}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

export default TextAlignButtons;
