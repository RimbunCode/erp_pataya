import { BubbleMenu } from "@tiptap/react/menus";
import {
  EditorContent,
  ReactRenderer,
  posToDOMRect,
  useEditor,
} from "@tiptap/react";
import { computePosition, flip, shift } from "@floating-ui/dom";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import TiptapMentionList from "./TiptapMentionList";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent text-foreground disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

function MenuBar({ editor, imageUploadUrl, handleImageUpload, fileInputRef }) {
  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/50">
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Marks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline"
      >
        <UnderlineIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code Block"
      >
        <Code className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Ordered List"
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Text Align */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Align Left"
      >
        <AlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Align Center"
      >
        <AlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Align Right"
      >
        <AlignRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        active={editor.isActive({ textAlign: "justify" })}
        title="Justify"
      >
        <AlignJustify className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Link */}
      <ToolbarButton
        onClick={setLink}
        active={editor.isActive("link")}
        title="Link"
      >
        <LinkIcon className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
        title="Clear Formatting"
      >
        <RemoveFormatting className="size-3.5" />
      </ToolbarButton>

      {/* Image Upload */}
      {imageUploadUrl && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
          />
          <ToolbarDivider />
          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            title="Insert Image"
          >
            <ImageIcon size={14} />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

// Positions the suggestion popup at the caret using Floating UI.
// Mirrors Tiptap's official React mention example.
function updateMentionPosition(editor, element) {
  const virtualElement = {
    getBoundingClientRect: () =>
      posToDOMRect(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to,
      ),
  };

  computePosition(virtualElement, element, {
    placement: "bottom-start",
    strategy: "absolute",
    middleware: [shift(), flip()],
  }).then(({ x, y, strategy }) => {
    element.style.width = "max-content";
    element.style.position = strategy;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
}

function buildMentionSuggestion(mentionSourceRef) {
  return {
    char: "@",
    allowedPrefixes: [" "],
    items: async ({ query }) => {
      const fn = mentionSourceRef.current;
      if (!fn) return [];
      try {
        return await fn(query);
      } catch {
        return [];
      }
    },
    render: () => {
      let component;

      return {
        onStart: (props) => {
          component = new ReactRenderer(TiptapMentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          component.element.style.position = "absolute";
          component.element.style.zIndex = "100";

          document.body.appendChild(component.element);

          updateMentionPosition(props.editor, component.element);
        },
        onUpdate(props) {
          component.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          updateMentionPosition(props.editor, component.element);
        },
        onKeyDown(props) {
          if (props.event.key === "Escape") {
            component.destroy();
            return true;
          }

          return component.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          component.element.remove();
          component.destroy();
        },
      };
    },
  };
}

const TiptapEditor = forwardRef(function TiptapEditor(
  {
    value,
    onValueChange,
    placeholder,
    className,
    mentionSource,
    scrollable,
    imageUploadUrl,
  },
  ref,
) {
  const { t } = useLaravelReactI18n();
  const isUpdatingRef = useRef(false);
  const fileInputRef = useRef(null);
  // Keep mentionSource in a ref so buildMentionSuggestion can read latest value
  // without needing to recreate the extension on every render.
  const mentionSourceRef = useRef(mentionSource);
  useEffect(() => {
    mentionSourceRef.current = mentionSource;
  }, [mentionSource]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "tiptap-link",
        },
      }),
      ...(mentionSource
        ? [
            Mention.configure({
              HTMLAttributes: { class: "mention" },
              suggestion: buildMentionSuggestion(mentionSourceRef),
              renderHTML({ options, node }) {
                return [
                  "span",
                  {
                    "data-type": "mention",
                    "data-id": node.attrs.id,
                    class: "mention",
                  },
                  `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`,
                ];
              },
            }),
          ]
        : []),
    ],
    content: value ?? "",
    editorProps: {
      attributes: {
        class: "outline-none min-h-[100px] p-3",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate({ editor }) {
      if (isUpdatingRef.current) return;
      onValueChange?.(editor.getJSON(), editor.getHTML());
    },
  });

  const handleImageUpload = async (file) => {
    if (!imageUploadUrl || !file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const csrfToken =
        document.querySelector('meta[name="csrf-token"]')?.content ?? "";
      const res = await fetch(imageUploadUrl, {
        method: "POST",
        headers: { "X-CSRF-TOKEN": csrfToken },
        body: formData,
      });
      const json = await res.json();
      if (json.url) {
        editor.chain().focus().setImage({ src: json.url }).run();
        toast.success(t("core.upload_file.image_upload_success"));
      } else {
        toast.error(t("core.upload_file.image_upload_error"));
      }
    } catch (e) {
      console.error("Image upload failed", e);
      toast.error(t("core.upload_file.image_upload_error"));
    }
  };

  // Sync controlled value → editor content
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const incomingJson = JSON.stringify(value ?? {});
    if (currentJson === incomingJson) return;
    isUpdatingRef.current = true;
    editor.commands.setContent(value ?? "", false);
    isUpdatingRef.current = false;
  }, [value, editor]);

  useImperativeHandle(ref, () => ({
    getHTML: () => editor?.getHTML() ?? "",
    getJSON: () => editor?.getJSON() ?? {},
    isEmpty: editor?.isEmpty ?? true,
    focus: () => editor?.commands.focus(),
    clearContent: () => editor?.commands.clearContent(true),
  }));

  return (
    <div
      className={cn(
        "border border-input rounded-lg bg-background overflow-hidden",
        scrollable && "flex flex-col",
        className,
      )}
    >
      <MenuBar
        editor={editor}
        imageUploadUrl={imageUploadUrl}
        handleImageUpload={handleImageUpload}
        fileInputRef={fileInputRef}
      />
      <EditorContent
        editor={editor}
        className={scrollable ? "flex-1 min-h-0 overflow-y-auto" : undefined}
      />
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex items-center gap-0.5 bg-popover border border-border rounded-md shadow-md p-1"
        >
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline"
          >
            <UnderlineIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strike"
          >
            <Strikethrough className="size-3.5" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            onClick={() => {
              const prev = editor.getAttributes("link").href;
              const url = window.prompt("URL", prev ?? "https://");
              if (url === null) return;
              if (url === "") {
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
                return;
              }
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
            }}
            active={editor.isActive("link")}
            title="Link"
          >
            <LinkIcon className="size-3.5" />
          </ToolbarButton>
        </BubbleMenu>
      )}
    </div>
  );
});

export default TiptapEditor;
