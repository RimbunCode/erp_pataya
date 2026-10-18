import { formatNumber } from "@/Components/NumberInput/formatNumber";
import { cn } from "@/lib/utils";
import usePageProps from "../usePageProps";

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Nilai progress 0-100 atau null (kosong / bukan angka).
 * @param {unknown} value
 * @returns {number|null}
 */
export function normalizeProgress(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.min(100, Math.max(0, number));
}

/**
 * Progress donut (default) atau bar. Biru selama < 100, hijau saat 100,
 * "–" bila nilai kosong. SVG/CSS ringan, bukan chart library.
 * @param {object} props
 * @param {number|string|null} [props.value] 0-100
 * @param {"donut"|"bar"} [props.shape]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export default function TemplateProgress({ value, shape, className }) {
  const { preferences } = usePageProps();
  const progress = normalizeProgress(value);

  if (progress === null) {
    return <span className={cn("text-muted-foreground", className)}>–</span>;
  }

  const complete = progress >= 100;
  const label = formatNumber(progress, {
    numberFormat: preferences?.default_number_format,
    suffix: "%",
  });
  const aria = {
    role: "progressbar",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": progress,
    "aria-valuetext": label,
  };

  // Nilai persen selalu di SAMPING bentuk (bar maupun donut). Bar mengisi sisa
  // lebar sel/kolom (flex-1) dengan lebar minimum agar tidak mengecil jadi garis.
  if (shape === "bar") {
    return (
      <span
        className={cn("flex w-full items-center gap-2", className)}
        data-shape="bar"
      >
        <span
          {...aria}
          className="block h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <span
            data-slot="fill"
            className={cn(
              "block h-full rounded-full",
              complete ? "bg-green-500" : "bg-blue-500",
            )}
            style={{ width: `${progress}%` }}
          />
        </span>
        <span className="shrink-0 text-xs tabular-nums">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      data-shape="donut"
    >
      <span {...aria} className="inline-flex size-8 shrink-0">
        <svg
          viewBox="0 0 36 36"
          className="size-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="18"
            cy="18"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            className="stroke-muted"
          />
          <circle
            data-slot="arc"
            cx="18"
            cy="18"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className={complete ? "stroke-green-500" : "stroke-blue-500"}
            strokeDasharray={`${(progress / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        </svg>
      </span>
      <span className="shrink-0 text-xs tabular-nums">{label}</span>
    </span>
  );
}
