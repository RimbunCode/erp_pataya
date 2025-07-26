import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { Mention, MentionsInput } from "@/Components/Mention";
import { useCallback, useState } from "react";

import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import { getRandomInt } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Show() {
  const { t, loading } = useLaravelReactI18n();
  const codeFormats = usePage().props.codeFormats;
  const [error, setError] = useState(null);
  const { data, setData } = useFormPage();
  const checkError = useCallback(
    (format) => {
      if (
        !/^(?:(?=.*@\[(mm|mmm|mmmm)\])(?=.*@\[(yy|yyyy)\])|(?=.*@\[(yy|yyyy)\])|(?!.*@\[(?:mm|mmm|mmmm|yy|yyyy)\])).*$/g.test(
          format,
        )
      ) {
        return t("core.formatingSeries.errors.month_invalid");
      }
      if (!/@\[[i]+\]/.test(format)) {
        return t("core.formatingSeries.errors.increment_notfound");
      }
    },
    [loading],
  );
  const formatingCode = useCallback(
    (format) => {
      format = format.replace(/@\[([^\]]+)\]/g, function (_, p1) {
        if (/^[i]+$/.test(p1)) {
          const current = getRandomInt(Math.pow(10, p1.length) - 1).toString();
          const display = current.padStart(p1.length, "0");
          return display;
        }
        const date = new Date();
        switch (p1) {
          case "yyyy":
            return date.getFullYear();
          case "yy":
            return date.getFullYear().toString().slice(-2);
          case "mmmm":
            return date.toLocaleString("default", { month: "long" });
          case "mmm":
            return date.toLocaleString("default", { month: "short" });
          case "mm":
            return (date.getMonth() + 1).toString().padStart(2, "0");
          default:
            return (
              formatingCode(codeFormats.find((x) => x.id == p1)?.value) ?? p1
            );
        }
      });
      return format;
    },
    [codeFormats],
  );
  return (
    <>
      <FormPageContent value="detail" title={null}>
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            error={error}
            required={true}
            label={t("core.formatingSeries.columns.format")}
          >
            <MentionsInput
              singleLine
              value={data.format ?? ""}
              onChange={(_, value) => {
                setData("format", value);
                setError(checkError(value));
              }}
              className="mentions"
              a11ySuggestionsListLabel={"Suggested mentions"}
              allowSuggestionsAboveCursor
              autoComplete="off"
              placeholder={t("core.formatingSeries.placeholder")}
            >
              <Mention
                markup="@[__id__]"
                trigger={/(\{([^{]*))$/}
                data={(search) => {
                  const contains = /@\[[i]+\]/.test(data.format);
                  let list = [];
                  if (!contains) {
                    const fixedLengthData = 5;
                    const length = /^[i]+$/.test(search) ? search.length : 1;

                    let start = length - Math.floor(fixedLengthData / 2);
                    start = start < 1 ? 1 : start;
                    const current = getRandomInt(
                      Math.pow(10, start) - 1,
                    ).toString();
                    list = Array.from({ length: fixedLengthData }, (_, i) => {
                      const display = current.padStart(start + i, "0");
                      return {
                        id: "i".repeat(start + i),
                        display: `${t("core.formatingSeries.formats.number")} (${display})`,
                      };
                    });
                    if (/^[i]+$/.test(search)) {
                      return list;
                    }
                  }

                  return [...list, ...codeFormats].filter((x) => {
                    const contains = data.format.includes(`@[${x.id}]`);
                    return (
                      !contains &&
                      (x.display.toLowerCase().includes(search.toLowerCase()) ||
                        x.id.toLowerCase().includes(search.toLowerCase()))
                    );
                  });
                }}
                displayTransform={(id) => "{" + id + "}"}
              />
            </MentionsInput>
          </FormInput>
          <FormInput label={t("core.formatingSeries.columns.example_result")}>
            <Input disabled value={formatingCode(data.format)} />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
