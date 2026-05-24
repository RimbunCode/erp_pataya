import { CheckIcon, XIcon } from "lucide-react";

import { useMemo } from "react";

const ENGLISH_PASSWORD_LABELS = {
  status: {
    weak: "Weak Security",
    medium: "Medium Security",
    good: "Good Security",
    strong: "Strong Security",
  },
  requirements: {
    length: "At least 8 characters (Required)",
    num: "At least 1 number",
    lowercase: "At least 1 lowercase letter",
    uppercase: "At least 1 uppercase letter",
    special: "At least 1 special character",
  },
};

function PasswordChecker({ password, forceEnglish = false }) {
  const labels = useMemo(() => {
    if (forceEnglish) {
      return ENGLISH_PASSWORD_LABELS;
    }

    return {
      status: {
        weak: "Weak Security",
        medium: "Medium Security",
        good: "Good Security",
        strong: "Strong Security",
      },
      requirements: {
        length: "At least 8 characters (Required)",
        lowercase: "At least 1 lowercase letter",
        uppercase: "At least 1 uppercase letter",
        num: "At least 1 number",
        special: "At least 1 special character",
      },
    };
  }, [forceEnglish]);

  const checkStrength = (pass) => {
    const requirements = [
      {
        regex: /.{8,}/,
        text: labels.requirements.length,
      },
      {
        regex: /[0-9]/,
        text: labels.requirements.num,
      },
      {
        regex: /[a-z]/,
        text: labels.requirements.lowercase,
      },
      {
        regex: /[A-Z]/,
        text: labels.requirements.uppercase,
      },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: labels.requirements.special,
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
    if (score <= 2) return labels.status.weak;
    if (score <= 3) return labels.status.medium;
    if (score <= 4) return labels.status.good;
    return labels.status.strong;
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
