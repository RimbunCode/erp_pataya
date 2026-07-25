import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

const LOCALES = [
  { code: "en", name: "English", countryCode: "gb" },
  { code: "id", name: "Bahasa Indonesia", countryCode: "id" },
];

const LanguageSwitcher = memo(({ className = "size-5" }) => {
  const { t } = useLaravelReactI18n();
  const currentLocale = usePage().props.lang;
  const activeLocale = LOCALES.find(({ code }) => code === currentLocale);

  const handleChange = (code) => {
    if (code === currentLocale) return;
    router.post(route("lang.set"), { code });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-lg p-2.5 h-fit w-fit text-sm text-gray-500 ring-1 ring-gray-200 hover:bg-gray-100 hover:outline-none dark:text-gray-400 dark:ring-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
        aria-label={t("lang.language")}
      >
        {activeLocale ? (
          <span
            className={cn(
              "block fi",
              `fi-${activeLocale.countryCode}`,
              className,
            )}
          />
        ) : (
          <svg
            className={className}
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM7.75 4.09a6.02 6.02 0 00-3.66 3.66c.44.16.9.3 1.38.4a13.02 13.02 0 011.28-3.9c.33-.06.66-.11 1-.16zm.87-.08a11.5 11.5 0 00-1.44 4.24c.58.06 1.18.1 1.82.1s1.24-.04 1.82-.1a11.5 11.5 0 00-1.44-4.24 8.03 8.03 0 00-.76 0zm2.11.08c.34.05.67.1 1 .16a13.02 13.02 0 011.28 3.9c.48-.1.94-.24 1.38-.4a6.02 6.02 0 00-3.66-3.66zM4 10c0 .5.05.98.14 1.45.58.2 1.2.36 1.86.48A14.66 14.66 0 016 10c0-.67.02-1.32.07-1.93a10.9 10.9 0 01-1.93-.55A5.98 5.98 0 004 10zm2.36 3.75c.16.48.3.94.4 1.38a6.02 6.02 0 003.29 2.7 11.5 11.5 0 01-1.44-4.24c-.76-.09-1.5-.22-2.25-.4v.56zm3.7.16c.06.58.1 1.18.1 1.82s-.04 1.24-.1 1.82c.25.04.5.06.76.06s.51-.02.76-.06c-.06-.58-.1-1.18-.1-1.82s.04-1.24.1-1.82a13.5 13.5 0 01-1.52 0zm2.58-.16v-.56c-.75.18-1.49.31-2.25.4a11.5 11.5 0 01-1.44 4.24 6.02 6.02 0 003.29-2.7c.1-.44.24-.9.4-1.38zm1.5-1.79c.66-.12 1.28-.28 1.86-.48.09-.47.14-.95.14-1.45s-.05-.98-.14-1.45a10.9 10.9 0 01-1.86.48c.05.61.07 1.26.07 1.93s-.02 1.32-.07 1.97z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent anchor="bottom end">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

LanguageSwitcher.displayName = "LanguageSwitcher";
export default LanguageSwitcher;
