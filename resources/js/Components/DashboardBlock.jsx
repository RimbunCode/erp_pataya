import ChartBlock from "@/Components/DashboardBlocks/ChartBlock";
import LinkCardBlock from "@/Components/DashboardBlocks/LinkCardBlock";
import NumberCardBlock from "@/Components/DashboardBlocks/NumberCardBlock";
import QuickListBlock from "@/Components/DashboardBlocks/QuickListBlock";
import SectionBlock from "@/Components/DashboardBlocks/SectionBlock";
import ShortcutBlock from "@/Components/DashboardBlocks/ShortcutBlock";
import SpacerBlock from "@/Components/DashboardBlocks/SpacerBlock";
import TextBlock from "@/Components/DashboardBlocks/TextBlock";

// Requirement 3.1: router tunggal per `type` — dipanggil DashboardCanvas
// untuk tiap block. number-card-chart-redesign: chart/card sekarang 2
// entity terpisah (Chart/NumberCard, bukan lagi Widget bertipe bar/pie/
// line/doughnut/card) — masing-masing block referensi entity-nya sendiri.
// onDelete diteruskan ke tiap block agar BlockEditDialog bisa membatalkan
// SELURUH insert saat Cancel ditekan pada block yang baru disisipkan
// (isNew). editOpen/onEditOpenChange: state Dialog config dikontrol
// SortableBlock (tombol Edit di toolbar) — diteruskan ke block yang punya
// BlockEditDialog.
export default function DashboardBlock({
  block,
  canEdit,
  onUpdate,
  onDelete,
  isDragActive,
  activeDragType,
  depth,
  editOpen,
  onEditOpenChange,
  onEjectChild,
}) {
  switch (block.type) {
    case "chart":
      return (
        <ChartBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    case "card":
      return (
        <NumberCardBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    case "section":
      return (
        <SectionBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          depth={depth}
          isDragActive={isDragActive}
          activeDragType={activeDragType}
          onEjectChild={onEjectChild}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    case "text":
      return (
        <TextBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    case "spacer":
      return (
        <SpacerBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    case "shortcut":
      return (
        <ShortcutBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    case "link_card":
      return (
        <LinkCardBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isDragActive={isDragActive}
          activeDragType={activeDragType}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    case "link_card_item":
      return (
        <div className="rounded border p-2 text-sm">{block.config?.label}</div>
      );
    case "quick_list":
      return (
        <QuickListBlock
          block={block}
          canEdit={canEdit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          editOpen={editOpen}
          onEditOpenChange={onEditOpenChange}
        />
      );
    default:
      return null;
  }
}
