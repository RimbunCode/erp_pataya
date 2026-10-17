import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { cn } from "@/lib/utils";
import { childrenToText } from "./utils";

/**
 * <truncate> -- satu baris terpotong "…" dengan tooltip teks penuh.
 * @param {object} props
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function TemplateTruncate({ className, children }) {
  const fullText = childrenToText(children).trim();
  const content = (
    <span className={cn("block max-w-full truncate", className)}>
      {children}
    </span>
  );
  if (fullText === "") {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{fullText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
