import { useState } from "react";
import { router, useForm } from "@inertiajs/react";

export default function CourseDetailSectionNotes({ notes = [], sectionId }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data, setData, post, processing, reset } = useForm({ content: "" });

  const submit = () => {
    post(route("instructor.classes.sections.notes.store", sectionId), {
      onSuccess: () => {
        reset();
        setAdding(false);
      },
      preserveScroll: true,
    });
  };

  const deleteNote = (noteId) => {
    router.delete(route("instructor.classes.sections.notes.destroy", noteId), {
      preserveScroll: true,
    });
  };

  return (
    <div className="border-t border-gray-100 mt-3 pt-3">
      <button
        onClick={() => setOpen((currentOpenState) => !currentOpenState)}
        className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-amber-500 hover:text-amber-600 transition-colors"
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
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Notes ({notes.length})
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
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
      {open && (
        <div className="mt-3 space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 group"
            >
              <p className="text-sm text-gray-600 leading-relaxed flex-1">
                {note.message}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-300 font-medium">
                  {note.created_at}
                </span>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg
                    className="w-3 h-3"
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
            </div>
          ))}
          {notes.length === 0 && !adding && (
            <p className="text-xs text-amber-300 font-bold uppercase tracking-widest px-1">
              Belum ada note
            </p>
          )}
          {adding ? (
            <div className="space-y-2">
              <textarea
                value={data.content}
                onChange={(event) => setData("content", event.target.value)}
                rows={3}
                placeholder="Tulis note..."
                className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAdding(false);
                    reset();
                  }}
                  className="flex-1 py-2.5 text-xs font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={processing || !data.content.trim()}
                  className="flex-1 py-2.5 text-xs font-black tracking-widest uppercase bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50"
                >
                  {processing ? "..." : "Post Note"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs font-black tracking-widest uppercase text-amber-500 hover:text-amber-600 transition-colors px-1"
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
              Add Note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
