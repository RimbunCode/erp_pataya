import React from "react";
import { Strikethrough, Type, Underline } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { ButtonGroup } from "@/Components/ui/button-group";
import { cn } from "@/lib/utils";

const DECORATION_OPTIONS = [
  { value: "none", label: "No decoration", icon: Type },
  { value: "underline", label: "Underline", icon: Underline },
  { value: "line-through", label: "Strikethrough", icon: Strikethrough },
];

function TextDecorationButtons({ prop }) {
  const currentValue = String(prop.getValue?.() || "").toLowerCase() || "none";

  return (
    <ButtonGroup className="w-full">
      {DECORATION_OPTIONS.map((option) => {
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

export default TextDecorationButtons;
