import { CheckIcon, XIcon } from "lucide-react";

import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

function PasswordChecker({ password }) {
  const { t } = useLaravelReactI18n();
  const checkStrength = (pass) => {
    const requirements = [
      {
        regex: /.{8,}/,
        text: t("auth.register.password.strengths.requirements.length"),
      },
      {
        regex: /[0-9]/,
        text: t("auth.register.password.strengths.requirements.num"),
      },
      {
        regex: /[a-z]/,
        text: t("auth.register.password.strengths.requirements.lowercase"),
      },
      {
        regex: /[A-Z]/,
        text: t("auth.register.password.strengths.requirements.uppercase"),
      },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: t("auth.register.password.strengths.requirements.special"),
      },
    ];
    return requirements.map((req) => ({
      met: req.regex.test(pass),
      text: req.text,
    }));
  };
  const strength = checkStrength(password);
  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length;
  }, [strength]);
  const getStrengthColor = (score) => {
    if (score === 0) return "bg-border";
    if (score <= 1) return "bg-red-500";
    if (score <= 2) return "bg-orange-500";
    if (score <= 3) return "bg-amber-500";
    if (score <= 4) return "bg-green-500";
    return "bg-emerald-500";
  };
  const getStrengthText = (score) => {
    if (score === 0) return "";
    if (score <= 2) return t("auth.register.password.strengths.status.weak");
    if (score <= 3) return t("auth.register.password.strengths.status.medium");
    if (score <= 4) return t("auth.register.password.strengths.status.good");
    return t("auth.register.password.strengths.status.strong");
  };
  return (
    <>
      <div className="mt-2 flex items-center justify-between">
        <p
          className="text-foreground text-sm font-medium"
          id={`password-description`}
        >
          {getStrengthText(strengthScore)}
        </p>
      </div>
      <div
        aria-label="Password strength"
        aria-valuemax={5}
        aria-valuemin={0}
        aria-valuenow={strengthScore}
        className="mb-3 flex gap-1"
        role="progressbar"
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
              i < strengthScore ? getStrengthColor(strengthScore) : "bg-border"
            }`}
          />
        ))}
      </div>
      <ul aria-label="Password requirements" className="space-y-1.5">
        {strength.map((req) => (
          <li className="flex items-center gap-1" key={req.text}>
            {req.met ? (
              <CheckIcon
                className="size-3.5 text-emerald-500"
                aria-hidden="true"
              />
            ) : (
              <XIcon
                className="text-muted-foreground/60 size-3.5"
                aria-hidden="true"
              />
            )}
            <span
              className={`text-xs transition-colors ${req.met ? "text-emerald-600" : "text-muted-foreground"}`}
            >
              {req.text}
              <span className="sr-only">
                {req.met ? " - Requirement met" : " - Requirement not met"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default PasswordChecker;
