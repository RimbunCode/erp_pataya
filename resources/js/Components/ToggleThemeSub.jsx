import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./ui/dropdown-menu";
import { Moon, Sun, SunMoon } from "lucide-react";

import { memo } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useTheme from "@/Hooks/useTheme";

const ToggleThemeSub = memo(() => {
  const { t } = useLaravelReactI18n();
  const { currentTheme, theme, setTheme } = useTheme();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {currentTheme == "dark" ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
        {t("theme.theme")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={setTheme}
          className="space-y-1"
        >
          <DropdownMenuRadioItem
            value="light"
            className="cursor-pointer gap-x-2"
          >
            <Sun className="size-4" />
            {t("theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="cursor-pointer gap-x-2"
          >
            <Moon className="size-4" />
            {t("theme.dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem
            value="system"
            className="cursor-pointer gap-x-2"
          >
            <SunMoon className="size-4" />
            {t("theme.system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
});

ToggleThemeSub.displayName = "ToggleThemeSub";
export default ToggleThemeSub;
