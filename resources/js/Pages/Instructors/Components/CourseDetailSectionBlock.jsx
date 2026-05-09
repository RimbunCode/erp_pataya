import { useState } from "react";
import { router } from "@inertiajs/react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTriggerCustom,
} from "@/Components/ui/accordion";
import CourseDetailContentBucket from "./CourseDetailContentBucket";
import CourseDetailSectionNotes from "./CourseDetailSectionNotes";

export default function CourseDetailSectionBlock({
  section,
  index,
  onDelete,
  value,
  isOpen,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);

  const saveTitle = () => {
    router.patch(
      route("instructor.classes.sections.update", section.id),
      { title },
      { onSuccess: () => setEditingTitle(false), preserveScroll: true },
    );
  };

  const deleteContent = (contentId) => {
    if (!confirm("Hapus konten ini?")) {
      return;
    }

    router.delete(
      route("instructor.classes.sections.contents.destroy", contentId),
      {
        preserveScroll: true,
      },
    );
  };

  const byType = (type) =>
    (section.contents ?? []).filter((contentItem) => contentItem.type === type);

  return (
    <div className="border-2 border-gray-100 rounded-2xl overflow-hidden">
      <AccordionItem value={value} className="border-0">
        <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
          <AccordionTriggerCustom
            asChild
            className="py-0 flex-1 w-full hover:no-underline"
          >
            <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              {editingTitle ? (
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      saveTitle();
                    }
                    if (event.key === "Escape") {
                      setEditingTitle(false);
                      setTitle(section.title);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-base font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="flex-1 text-base font-black text-gray-800 uppercase tracking-wide truncate">
                  {section.title}
                </span>
              )}
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </AccordionTriggerCustom>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editingTitle ? (
              <>
                <button
                  onClick={saveTitle}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setEditingTitle(false);
                    setTitle(section.title);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 transition-all"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-300 hover:text-blue-500 hover:border-blue-300 transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={() => onDelete(section.id)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
        <AccordionContent className="pb-0 pt-0">
          <div className="p-5 space-y-6">
            <CourseDetailContentBucket
              type="pre_assessment"
              contents={byType("pre_assessment")}
              sectionId={section.id}
              onDelete={deleteContent}
            />
            <CourseDetailContentBucket
              type="material"
              contents={byType("material")}
              sectionId={section.id}
              onDelete={deleteContent}
            />
            <CourseDetailContentBucket
              type="assignment"
              contents={byType("assignment")}
              sectionId={section.id}
              onDelete={deleteContent}
            />
            <CourseDetailSectionNotes
              notes={section.notes ?? []}
              sectionId={section.id}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}
