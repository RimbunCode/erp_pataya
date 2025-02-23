import { useLaravelReactI18n } from "laravel-react-i18n";

export default function useLocale() {
  const { t: trans, ...localeFunc } = useLaravelReactI18n();

  return {
    trans,
    ...localeFunc,
  };
}
