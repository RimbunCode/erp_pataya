import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { ensureTiptapDoc } from "@/lib/tiptapContent";

function ToolButton({
  active = false,
  onClick,
  children,
  title,
  disabled = false,
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        active
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
          : "bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--background-accent)]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export default function TiptapFieldEditor({
  label,
  description = null,
  value,
  onChange,
  placeholder = "Type here...",
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: ensureTiptapDoc(value),
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[130px] max-h-[340px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-6 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextContent = ensureTiptapDoc(value);
    const currentContent = editor.getJSON();

    if (JSON.stringify(currentContent) === JSON.stringify(nextContent)) {
      return;
    }

    editor.commands.setContent(nextContent, false);
  }, [editor, value]);

  const setOrUnsetLink = () => {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Masukkan URL", previousUrl);

    if (url === null) {
      return;
    }

    const normalizedUrl = url.trim();

    if (normalizedUrl === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: normalizedUrl })
      .run();
  };

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
          {label}
        </p>
        {description && (
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
        <ToolButton
          title="Bold"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </ToolButton>
        <ToolButton
          title="Italic"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          Italic
        </ToolButton>
        <ToolButton
          title="Underline"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          Underline
        </ToolButton>
        <ToolButton
          title="Strike"
          active={editor?.isActive("strike")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          Strike
        </ToolButton>
        <ToolButton
          title="Bullet list"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          Bullet
        </ToolButton>
        <ToolButton
          title="Ordered list"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          Number
        </ToolButton>
        <ToolButton
          title="Heading 2"
          active={editor?.isActive("heading", { level: 2 })}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </ToolButton>
        <ToolButton
          title="Heading 3"
          active={editor?.isActive("heading", { level: 3 })}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </ToolButton>
        <ToolButton
          title="Align left"
          active={editor?.isActive({ textAlign: "left" })}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          Left
        </ToolButton>
        <ToolButton
          title="Align center"
          active={editor?.isActive({ textAlign: "center" })}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          Center
        </ToolButton>
        <ToolButton
          title="Align right"
          active={editor?.isActive({ textAlign: "right" })}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          Right
        </ToolButton>
        <ToolButton
          title="Set link"
          active={editor?.isActive("link")}
          onClick={setOrUnsetLink}
        >
          Link
        </ToolButton>
        <ToolButton
          title="Undo"
          disabled={!editor?.can().chain().focus().undo().run()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          Undo
        </ToolButton>
        <ToolButton
          title="Redo"
          disabled={!editor?.can().chain().focus().redo().run()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          Redo
        </ToolButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
