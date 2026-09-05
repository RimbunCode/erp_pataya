import React, { Suspense, useMemo } from "react";

import { FormPageDiff } from "./FormPage";
import LoadingIcon from "@/Components/LoadingIcon";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function ShowLog({ title, formPathname }) {
  const { t } = useLaravelReactI18n();
  // Menggunakan useMemo untuk memuat komponen hanya ketika namefile berubah
  const FormComponent = useMemo(() => {
    // Gunakan import.meta.glob untuk daftar semua Form
    let modules = import.meta.glob([
      `../**/*.jsx`,
      `!../**/*.test.jsx`,
      `!../**/*.rtl.test.jsx`,
    ]);
    if (Object.keys(modules).length <= 0) return null;
    const module = modules[`../${formPathname}.jsx`];
    if (typeof module === "undefined") {
      return null;
    }

    // Lazy load komponen
    return React.lazy(module);
  }, [formPathname]);

  return (
    <FormPageDiff title={title} disabled>
      {FormComponent ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4">
              <LoadingIcon className="size-4" />
              <span>{t("core.form.loading")} ...</span>
            </div>
          }
        >
          <FormComponent />
        </Suspense>
      ) : (
        <div>Form tidak ditemukan</div>
      )}
    </FormPageDiff>
  );
}
