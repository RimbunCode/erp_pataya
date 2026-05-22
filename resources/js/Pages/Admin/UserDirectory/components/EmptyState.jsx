import Icon from "@/Components/ui/Icon";

export default function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-[var(--muted-foreground)] gap-2">
      <Icon d={icon} cls="w-8 h-8 opacity-30" />
      <p className="text-xs">{text}</p>
    </div>
  );
}
