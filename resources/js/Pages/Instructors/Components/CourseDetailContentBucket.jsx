import { useState } from "react";
import { router } from "@inertiajs/react";
import CourseDetailTypeIcon from "./CourseDetailTypeIcon";
import CourseDetailContentRow from "./CourseDetailContentRow";
import { contentTypes } from "./CourseDetailConfig";

export default function CourseDetailContentBucket({
  type,
  contents,
  sectionId,
  onDelete,
}) {
  const cfg = contentTypes[type];
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const addContent = () => {
    if (!title.trim()) {
      return;
    }

    router.post(
      route("instructor.classes.sections.contents.store", sectionId),
      { title, type },
      {
        onSuccess: () => {
          setAdding(false);
          setTitle("");
        },
        preserveScroll: true,
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CourseDetailTypeIcon type={type} />
          <span
            className={`text-xs font-black tracking-widest uppercase ${cfg.text}`}
          >
            {cfg.label}
          </span>
          <span className="text-xs text-gray-300 font-bold">
            ({contents.length})
          </span>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black tracking-widest uppercase rounded-lg border ${cfg.tab} transition-all`}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Tambah
          </button>
        )}
      </div>
      {contents.map((content) => (
        <CourseDetailContentRow
          key={content.id}
          content={content}
          onDelete={onDelete}
          typeCfg={cfg}
        />
      ))}
      {contents.length === 0 && !adding && (
        <div
          className={`px-3 py-2.5 rounded-xl border border-dashed ${cfg.bg} flex items-center gap-2`}
        >
          <CourseDetailTypeIcon type={type} />
          <p className={`text-xs font-bold ${cfg.text} opacity-50`}>
            Belum ada {cfg.label.toLowerCase()}
          </p>
        </div>
      )}
      {adding && (
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl border ${cfg.bg}`}
          >
            <CourseDetailTypeIcon type={type} />
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addContent();
                }
                if (event.key === "Escape") {
                  setAdding(false);
                  setTitle("");
                }
              }}
              placeholder={`Judul ${cfg.label.toLowerCase()}... (Enter untuk simpan)`}
              className="flex-1 bg-transparent text-sm font-bold text-gray-700 placeholder-gray-300 focus:outline-none"
            />
          </div>
          <button
            onClick={addContent}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
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
              setAdding(false);
              setTitle("");
            }}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
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
        </div>
      )}
    </div>
  );
}
