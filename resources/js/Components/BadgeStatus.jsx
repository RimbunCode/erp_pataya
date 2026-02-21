import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
const theme = {
  draft: "secondary",
  submitted: "primary",
  canceled: "error",
  approved: "success",
  rejected: "error",
  pending: "warning",
  completed: "success",
  active: "success",
  inactive: "error",
  deleted: "error",
  closed: "error",
  in_progress: "primary",
  need_approval: "warning",
  waiting: "secondary",
  delivered: "success",
  billed: "success",
  overdue: "error",
  to_bill: "warning",
  to_deliver: "warning",
  returned: "gray",
  in_rent: "primary",
  to_receive: "warning",
  received: "success",
  partially_received: "warning",
  unpaid: "warning",
  partially_paid: "warning",
  paid: "success",
  skipped: "secondary",
  reserved: "warning",
  partially_billed: "warning",
  partially_delivered: "warning",
  to_order: "warning",
  partially_ordered: "warning",
  ordered: "success",
};
export default function BadgeStatus({ status, className, ...props }) {
  const { t } = useLaravelReactI18n();
  [status];
  return (
    <span
      className={cn(
        "text-center badge w-fit",
        theme[status] ?? "secondary",
        className,
      )}
      {...props}
    >
      {status == "in_progress" && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <circle cx={18} cy={12} r={0} fill="currentColor">
            <animate
              attributeName="r"
              begin={0.67}
              calcMode="spline"
              dur="1.5s"
              keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
              repeatCount="indefinite"
              values="0;2;0;0"
            ></animate>
          </circle>
          <circle cx={12} cy={12} r={0} fill="currentColor">
            <animate
              attributeName="r"
              begin={0.33}
              calcMode="spline"
              dur="1.5s"
              keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
              repeatCount="indefinite"
              values="0;2;0;0"
            ></animate>
          </circle>
          <circle cx={6} cy={12} r={0} fill="currentColor">
            <animate
              attributeName="r"
              begin={0}
              calcMode="spline"
              dur="1.5s"
              keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
              repeatCount="indefinite"
              values="0;2;0;0"
            ></animate>
          </circle>
        </svg>
      )}
      {t(`status.${status}`)}
    </span>
  );
}
