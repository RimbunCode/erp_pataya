import { cn } from "@/lib/utils";
import { docToHtml } from "@/lib/tiptapContent";

export default function TiptapHtmlRenderer({ doc, className }) {
  const html = docToHtml(doc);

  if (!html) return null;

  return (
    <div
      className={cn(
        "tiptap-rendered",
        "[&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through",
        "[&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-80",
        "[&_h2]:text-2xl [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mb-3",
        "[&_h3]:text-xl [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mb-2",
        "[&_p]:mb-2 last:[&_p]:mb-0",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
