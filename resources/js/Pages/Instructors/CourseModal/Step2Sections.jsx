/**
 * Step2Sections — Editor sections & content, hanya digunakan pada mode create.
 *
 * Props:
 *   sections        - array state sections
 *   onAddSection
 *   onRemoveSection
 *   onUpdateSection
 *   onAddContent
 *   onRemoveContent
 *   onUpdateContent
 */
export default function Step2Sections({
  sections,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onAddContent,
  onRemoveContent,
  onUpdateContent,
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">
          Add sections and content for your course.
        </p>
        <button
          onClick={onAddSection}
          className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase text-primary hover:text-primary transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Section
        </button>
      </div>

      {sections.map((section, si) => (
        <SectionCard
          key={section.id}
          section={section}
          index={si}
          canDelete={sections.length > 1}
          onRemove={() => onRemoveSection(section.id)}
          onUpdateTitle={(val) => onUpdateSection(section.id, val)}
          onAddContent={() => onAddContent(section.id)}
          onRemoveContent={(cid) => onRemoveContent(section.id, cid)}
          onUpdateContent={(cid, field, val) => onUpdateContent(section.id, cid, field, val)}
        />
      ))}
    </div>
  );
}

// ── Sub-komponen: satu card section ──────────────────────────────────────────
function SectionCard({
  section,
  index,
  canDelete,
  onRemove,
  onUpdateTitle,
  onAddContent,
  onRemoveContent,
  onUpdateContent,
}) {
  return (
    <div className="border-2 border-border rounded-2xl overflow-hidden">
      {/* Header section */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-black text-white">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <input
          type="text"
          value={section.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          placeholder="Section title..."
          className="flex-1 bg-transparent text-sm font-bold text-foreground placeholder-muted-foreground focus:outline-none"
        />
        {canDelete && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Content list */}
      <div className="p-3 flex flex-col gap-2">
        {section.contents.map((content) => (
          <ContentRow
            key={content.id}
            content={content}
            onUpdate={(field, val) => onUpdateContent(content.id, field, val)}
            onRemove={() => onRemoveContent(content.id)}
          />
        ))}
        <button
          onClick={onAddContent}
          className="flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-xl transition-all"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Content
        </button>
      </div>
    </div>
  );
}

// ── Sub-komponen: satu baris content ─────────────────────────────────────────
function ContentRow({ content, onUpdate, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={content.type}
        onChange={(e) => onUpdate("type", e.target.value)}
        className="w-36 flex-shrink-0 bg-muted border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
      >
        <option value="pre_assessment">Pre Assessment</option>
        <option value="material">Material</option>
        <option value="assignment">Assignment</option>
      </select>
      <input
        type="text"
        value={content.title}
        onChange={(e) => onUpdate("title", e.target.value)}
        placeholder="Content title..."
        className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
      />
      <button
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
