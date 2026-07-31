import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

const theme = {
  task: "primary",
  event: "secondary",
  meeting: "secondary",
  deadline: "warning",
};

export default function BadgeTodoType({ type, className, ...props }) {
  const { t } = useLaravelReactI18n();

  return (
    <span
      className={cn(
        "text-center badge w-fit",
        theme[type] ?? "secondary",
        className,
      )}
      {...props}
    >
      {t(`core.todo.type.options.${type}`)}
    </span>
  );
}
