import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "./ui/dropdown-menu";

import { Languages } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

const LOCALES = [
  { code: "en", name: "English", countryCode: "gb" },
  { code: "id", name: "Bahasa Indonesia", countryCode: "id" },
];

const LanguageSwitcherSub = memo(() => {
  const { t } = useLaravelReactI18n();
  const currentLocale = usePage().props.lang;

  const handleChange = (code) => {
    if (code === currentLocale) return;
    router.post(route("lang.set"), { code });
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="size-4" />
        {t("lang.language")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={currentLocale}
          onValueChange={handleChange}
          className="space-y-1"
        >
          {LOCALES.map(({ code, name, countryCode }) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              className="cursor-pointer gap-x-2"
            >
              <span className={cn("fi", `fi-${countryCode}`)} />
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
});

LanguageSwitcherSub.displayName = "LanguageSwitcherSub";
export default LanguageSwitcherSub;
