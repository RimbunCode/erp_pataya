var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import "quill-mention/autoregister";
import { A as Avatar, a as AvatarImage, b as AvatarFallback } from "./avatar-_KK8H2Pc.js";
import { usePage, router, Deferred } from "@inertiajs/react";
import { SendHorizonal, Paperclip, MessageSquare, Trash2 } from "lucide-react";
import React__default, { memo, useRef, useState, useEffect, useCallback } from "react";
import { f as isNullOrWhitespace, p as cleanedQuillOutput, c as cn, a as getLocaleDate } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { L as LoadingIcon } from "./LoadingIcon-CRleOEtX.js";
import QueryString from "qs";
import Quill from "quill";
import { TZDate } from "@date-fns/tz";
import axios from "axios";
import { debounce } from "lodash";
import { format } from "date-fns";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-avatar";
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "radix-ui";
import "class-variance-authority";
import "@inertiajs/core";
import "zustand";
const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function postpone(fn) {
  Promise.resolve().then(fn);
}
class ReactQuill extends React__default.Component {
  constructor(props) {
    super(props);
    /*
    Changing one of these props should cause a full re-render and a
    re-instantiation of the Quill editor.
    */
    __publicField(this, "dirtyProps", ["modules", "formats", "bounds", "theme", "children"]);
    /*
    Changing one of these props should cause a regular update. These are mostly
    props that act on the container, rather than the quillized editing area.
    */
    __publicField(this, "cleanProps", [
      "id",
      "className",
      "style",
      "placeholder",
      "tabIndex",
      "onChange",
      "onChangeSelection",
      "onFocus",
      "onBlur",
      "onKeyPress",
      "onKeyDown",
      "onKeyUp"
    ]);
    __publicField(this, "state", {
      generation: 0
    });
    /*
    The Quill Editor instance.
    */
    __publicField(this, "editor");
    /*
    Reference to the element holding the Quill editing area.
    */
    __publicField(this, "editingArea");
    /*
    Tracks the internal value of the Quill editor
    */
    __publicField(this, "value");
    /*
    Tracks the internal selection of the Quill editor
    */
    __publicField(this, "selection");
    /*
    Used to compare whether deltas from `onChange` are being used as `value`.
    */
    __publicField(this, "lastDeltaChangeSet");
    /*
    Stores the contents of the editor to be restored after regeneration.
    */
    __publicField(this, "regenerationSnapshot");
    /*
    A weaker, unprivileged proxy for the editor that does not allow accidentally
    modifying editor state.
    */
    __publicField(this, "unprivilegedEditor");
    __publicField(this, "onEditorChange", (eventName, rangeOrDelta, oldRangeOrDelta, source) => {
      var _a, _b;
      if (eventName === "text-change") {
        (_a = this.onEditorChangeText) == null ? void 0 : _a.call(
          this,
          this.editor.root.innerHTML,
          rangeOrDelta,
          source,
          this.unprivilegedEditor
        );
      } else if (eventName === "selection-change") {
        (_b = this.onEditorChangeSelection) == null ? void 0 : _b.call(
          this,
          rangeOrDelta,
          source,
          this.unprivilegedEditor
        );
      }
    });
    const value = this.isControlled() ? props.value : props.defaultValue;
    this.value = value ?? "";
    this.element = React__default.createRef();
  }
  validateProps(props) {
    if (React__default.Children.count(props.children) > 1)
      throw new Error(
        "The Quill editing area can only be composed of a single React element."
      );
    if (React__default.Children.count(props.children)) {
      const child = React__default.Children.only(props.children);
      if ((child == null ? void 0 : child.type) === "textarea")
        throw new Error(
          "Quill does not support editing on a <textarea>. Use a <div> instead."
        );
    }
    if (this.lastDeltaChangeSet && props.value === this.lastDeltaChangeSet)
      throw new Error(
        "You are passing the `delta` object from the `onChange` event back as `value`. You most probably want `editor.getContents()` instead. See: https://github.com/zenoamaro/react-quill#using-deltas"
      );
  }
  shouldComponentUpdate(nextProps, nextState) {
    this.validateProps(nextProps);
    if (!this.editor || this.state.generation !== nextState.generation) {
      return true;
    }
    if ("value" in nextProps) {
      const prevContents = this.getEditorContents();
      const nextContents = nextProps.value ?? "";
      if (!this.isEqualValue(nextContents, prevContents)) {
        this.setEditorContents(this.editor, nextContents);
      }
    }
    if (nextProps.readOnly !== this.props.readOnly) {
      this.setEditorReadOnly(this.editor, nextProps.readOnly);
    }
    return [...this.cleanProps, ...this.dirtyProps].some((prop) => {
      return !isEqual(nextProps[prop], this.props[prop]);
    });
  }
  shouldComponentRegenerate(nextProps) {
    return this.dirtyProps.some((prop) => {
      return !isEqual(nextProps[prop], this.props[prop]);
    });
  }
  componentDidMount() {
    this.instantiateEditor();
    this.setEditorContents(this.editor, this.getEditorContents());
  }
  componentWillUnmount() {
    this.destroyEditor();
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.editor && this.shouldComponentRegenerate(prevProps)) {
      const delta = this.editor.getContents();
      const selection = this.editor.getSelection();
      this.regenerationSnapshot = { delta, selection };
      this.setState({ generation: this.state.generation + 1 });
      this.destroyEditor();
    }
    if (this.state.generation !== prevState.generation) {
      const { delta, selection } = this.regenerationSnapshot;
      delete this.regenerationSnapshot;
      this.instantiateEditor();
      const editor = this.editor;
      editor.setContents(delta);
      postpone(() => this.setEditorSelection(editor, selection));
    }
  }
  instantiateEditor() {
    if (this.editor) {
      this.hookEditor(this.editor);
    } else {
      this.editor = this.createEditor(
        this.getEditingArea(),
        this.getEditorConfig()
      );
    }
  }
  destroyEditor() {
    if (!this.editor) return;
    this.unhookEditor(this.editor);
  }
  /*
  We consider the component to be controlled if `value` is being sent in props.
  */
  isControlled() {
    return "value" in this.props;
  }
  getEditorConfig() {
    return {
      bounds: this.props.bounds,
      formats: this.props.formats,
      modules: this.props.modules,
      placeholder: this.props.placeholder,
      readOnly: this.props.readOnly,
      scrollingContainer: this.props.scrollingContainer,
      tabIndex: this.props.tabIndex,
      theme: this.props.theme
    };
  }
  getEditor() {
    if (!this.editor) throw new Error("Accessing non-instantiated editor");
    return this.editor;
  }
  /*
  Creates an editor on the given element. The editor will be passed the
  configuration, have its events bound,
  */
  createEditor(element, config) {
    const editor = new Quill(element, config);
    if (config.tabIndex != null) {
      this.setEditorTabIndex(editor, config.tabIndex);
    }
    this.hookEditor(editor);
    return editor;
  }
  hookEditor(editor) {
    this.unprivilegedEditor = this.makeUnprivilegedEditor(editor);
    editor.on("editor-change", this.onEditorChange);
  }
  unhookEditor(editor) {
    editor.off("editor-change", this.onEditorChange);
  }
  getEditorContents() {
    return this.value;
  }
  getEditorSelection() {
    return this.selection;
  }
  /*
  True if the value is a Delta instance or a Delta look-alike.
  */
  isDelta(value) {
    return value && value.ops;
  }
  /*
  Special comparison function that knows how to compare Deltas.
  */
  isEqualValue(value, nextValue) {
    if (this.isDelta(value) && this.isDelta(nextValue)) {
      return isEqual(value.ops, nextValue.ops);
    } else {
      return isEqual(value, nextValue);
    }
  }
  /*
  Replace the contents of the editor, but keep the previous selection hanging
  around so that the cursor won't move.
  */
  setEditorContents(editor, value) {
    this.value = value;
    const sel = this.getEditorSelection();
    if (typeof value === "string") {
      editor.setContents(editor.clipboard.convert(value));
    } else {
      editor.setContents(value);
    }
    postpone(() => this.setEditorSelection(editor, sel));
  }
  setEditorSelection(editor, range) {
    this.selection = range;
    if (range) {
      const length = editor.getLength();
      range.index = Math.max(0, Math.min(range.index, length - 1));
      range.length = Math.max(
        0,
        Math.min(range.length, length - 1 - range.index)
      );
      editor.setSelection(range);
    }
  }
  setEditorTabIndex(editor, tabIndex) {
    var _a;
    if ((_a = editor == null ? void 0 : editor.scroll) == null ? void 0 : _a.domNode) {
      editor.scroll.domNode.tabIndex = tabIndex;
    }
  }
  setEditorReadOnly(editor, value) {
    if (value) {
      editor.disable();
    } else {
      editor.enable();
    }
  }
  /*
  Returns a weaker, unprivileged proxy object that only exposes read-only
  accessors found on the editor instance, without any state-modifying methods.
  */
  makeUnprivilegedEditor(editor) {
    const e = editor;
    return {
      getHTML: () => e.root.innerHTML,
      getLength: e.getLength.bind(e),
      getText: e.getText.bind(e),
      getContents: e.getContents.bind(e),
      getSelection: e.getSelection.bind(e),
      getBounds: e.getBounds.bind(e)
    };
  }
  getEditingArea() {
    if (!this.editingArea) {
      throw new Error("Instantiating on missing editing area");
    }
    const element = this.editingArea;
    if (!element) {
      throw new Error("Cannot find element for editing area");
    }
    if (element.nodeType === 3) {
      throw new Error("Editing area cannot be a text node");
    }
    return element;
  }
  /*
  Renders an editor area, unless it has been provided one to clone.
  */
  renderEditingArea() {
    const { children, preserveWhitespace } = this.props;
    const { generation } = this.state;
    const properties = {
      ref: (instance) => {
        this.editingArea = instance;
      }
    };
    if (React__default.Children.count(children)) {
      return React__default.cloneElement(React__default.Children.only(children), {
        key: generation,
        ...properties
      });
    }
    return preserveWhitespace ? /* @__PURE__ */ jsx("pre", { ...properties }, generation) : /* @__PURE__ */ jsx("div", { ...properties }, generation);
  }
  render() {
    return /* @__PURE__ */ jsx(
      "div",
      {
        id: this.props.id,
        style: this.props.style,
        className: `quill ${this.props.className ?? ""}`,
        onKeyPress: this.props.onKeyPress,
        onKeyDown: this.props.onKeyDown,
        onKeyUp: this.props.onKeyUp,
        children: this.renderEditingArea()
      },
      this.state.generation
    );
  }
  onEditorChangeText(value, delta, source, editor) {
    var _a, _b;
    if (!this.editor) return;
    const nextContents = this.isDelta(this.value) ? editor.getContents() : editor.getHTML();
    if (nextContents !== this.getEditorContents()) {
      this.lastDeltaChangeSet = delta;
      this.value = nextContents;
      (_b = (_a = this.props).onChange) == null ? void 0 : _b.call(_a, value, delta, source, editor);
    }
  }
  onEditorChangeSelection(nextSelection, source, editor) {
    var _a, _b, _c, _d, _e, _f;
    if (!this.editor) return;
    const currentSelection = this.getEditorSelection();
    const hasGainedFocus = !currentSelection && nextSelection;
    const hasLostFocus = currentSelection && !nextSelection;
    if (isEqual(nextSelection, currentSelection)) return;
    this.selection = nextSelection;
    (_b = (_a = this.props).onChangeSelection) == null ? void 0 : _b.call(_a, nextSelection, source, editor);
    if (hasGainedFocus) {
      (_d = (_c = this.props).onFocus) == null ? void 0 : _d.call(_c, nextSelection, source, editor);
    } else if (hasLostFocus) {
      (_f = (_e = this.props).onBlur) == null ? void 0 : _f.call(_e, currentSelection, source, editor);
    }
  }
  focus() {
    if (!this.editor) return;
    this.editor.focus();
  }
  blur() {
    if (!this.editor) return;
    this.selection = null;
    this.editor.blur();
  }
}
__publicField(ReactQuill, "displayName", "React Quill");
/*
Export Quill to be able to call `register`
*/
__publicField(ReactQuill, "Quill", Quill);
__publicField(ReactQuill, "defaultProps", {
  theme: "snow",
  modules: {},
  readOnly: false
});
const Comments = memo(function Comments2() {
  const { logs, lang } = usePage().props;
  const { t } = useLaravelReactI18n();
  const commentRef = useRef();
  const route = window.route;
  const [comment, setComment] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [focusedOnComment, setFocusedOnComment] = useState(false);
  useEffect(() => {
    if (isNullOrWhitespace(comment) || comment === "<p><br></p>") {
      setShowSend(false);
    } else {
      setShowSend(true);
    }
  }, [comment]);
  const onSubmit = useCallback((_comment) => {
    router.post(
      route(route().current(), route().params) + "/comment",
      { comment: cleanedQuillOutput(_comment) },
      {
        reset: ["logs"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
        onSuccess: () => {
          setComment("");
          setFocusedOnComment(false);
          commentRef.current.blur();
        }
      }
    );
  }, []);
  const removeComment = useCallback((id) => {
    router.delete(route(route().current(), route().params) + `/comment/${id}`, {
      reset: ["logs"],
      preserveScroll: true,
      preserveState: true,
      replace: true
    });
  }, []);
  const onKeyDown = useCallback((e, comment2, focusedOnComment2) => {
    e.stopPropagation();
    if (e.ctrlKey && e.key == "b" && focusedOnComment2) {
      e.preventDefault();
    }
    if (e.ctrlKey && e.key == "Enter" && focusedOnComment2) {
      e.preventDefault();
      onSubmit(comment2);
    }
  }, []);
  const user = usePage().props.auth.user;
  const alias = user.name.split(" ").slice(0, 2).map((n) => n.charAt(0)).join("");
  const toolbarOptions = [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ["bold", "italic", "underline", "strike"],
    // toggled buttons
    [{ script: "sub" }, { script: "super" }],
    // superscript/subscript
    ["blockquote", "code-block"],
    ["link"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["clean"]
    // remove formatting button
  ];
  const mention = {
    allowedChars: /^[A-Za-z\sÅÄÖåäö]*$/,
    mentionDenotationChars: ["@"],
    source: debounce(async function(searchTerm, renderList) {
      const data = await axios.get(
        `${route("users.index")}?${QueryString.stringify({
          search: searchTerm,
          limit: 10
        })}`
      ).then((res) => {
        const data2 = res.data.map((x) => ({ id: x.id, value: x.name }));
        return data2;
      }).catch((err) => {
        console.log(err);
      });
      renderList(data, searchTerm);
    }, 500)
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-2", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: t("core.form.comments") }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: "flex w-full max-w-full gap-x-3",
          onKeyDown: (e) => {
            onKeyDown(e, comment, focusedOnComment);
          },
          children: [
            /* @__PURE__ */ jsxs(Avatar, { className: "rounded-full size-10", children: [
              user.image && /* @__PURE__ */ jsx(
                AvatarImage,
                {
                  src: route("files.preview", user.image) + `?v=${new Date(user.updated_at).getTime()}`,
                  alt: user.name
                }
              ),
              /* @__PURE__ */ jsx(AvatarFallback, { className: "text-xl font-semibold rounded-lg", children: alias })
            ] }),
            /* @__PURE__ */ jsx(
              ReactQuill,
              {
                ref: commentRef,
                placeholder: "Type a reply / comment",
                className: "bg-muted relative **:font-sans! focus:border-0! grid grid-cols-1 text-wrap w-full max-w-full grow  basis-0  rounded-lg border border-input  text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                theme: "bubble",
                value: comment,
                onChange: setComment,
                modules: {
                  toolbar: toolbarOptions,
                  mention
                },
                onFocus: () => setFocusedOnComment(true),
                onBlur: () => setFocusedOnComment(false)
              }
            ),
            showSend && /* @__PURE__ */ jsx(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "icon",
                className: "p-2!",
                onClick: () => onSubmit(comment),
                children: /* @__PURE__ */ jsx(SendHorizonal, { className: "size-6!" })
              }
            )
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-2", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: t("core.form.activity") }),
      /* @__PURE__ */ jsx("ol", { className: "relative ml-3.5 border-muted border-s-2 ", children: /* @__PURE__ */ jsx(
        Deferred,
        {
          data: ["logs"],
          fallback: /* @__PURE__ */ jsx("li", { className: "mb-3 first:mt-2 ms-6", children: /* @__PURE__ */ jsxs("div", { className: "text-base! font-normal text-foreground flex gap-x-4", children: [
            /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
            /* @__PURE__ */ jsxs("span", { children: [
              t("core.form.loading"),
              " ..."
            ] })
          ] }) }),
          children: logs && logs.map(
            ({ id, type, activity, user: user2, created_at, data_after }) => /* @__PURE__ */ jsxs("li", { className: "mb-3 first:mt-2 ms-6", children: [
              /* @__PURE__ */ jsxs(
                "div",
                {
                  className: cn(
                    type == "log" ? "bg-inherit" : "bg-muted border-[3px]",
                    "p-2 -mt-0.5 size-[34px] -start-[18px] border-muted flex justify-center items-center absolute rounded-full"
                  ),
                  children: [
                    type == "log" && /* @__PURE__ */ jsx("span", { className: "block rounded-full bg-accent-foreground size-2" }),
                    type == "attachment" && /* @__PURE__ */ jsx(Paperclip, { className: "size-4" }),
                    type == "comment" && /* @__PURE__ */ jsx(MessageSquare, { className: "size-4" })
                  ]
                }
              ),
              type == "comment" ? /* @__PURE__ */ jsxs("div", { className: "rounded-lg px-4 py-1 grid grid-cols-[auto_1fr] gap-x-4 border border-muted-foreground/30", children: [
                /* @__PURE__ */ jsx("div", { className: "flex items-center", children: /* @__PURE__ */ jsxs(Avatar, { className: "rounded-full h-max size-10", children: [
                  user2.image && /* @__PURE__ */ jsx(
                    AvatarImage,
                    {
                      src: route("files.preview", user2.image) + `?v=${new Date(user2.updated_at).getTime()}`,
                      alt: user2.name
                    }
                  ),
                  /* @__PURE__ */ jsx(AvatarFallback, { className: "text-xl font-semibold rounded-lg", children: alias })
                ] }) }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center border-b border-muted-foreground/30", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsx(
                      Link,
                      {
                        href: route("users.show", user2.id),
                        className: "hover:underline",
                        children: user2.name
                      }
                    ),
                    " ",
                    /* @__PURE__ */ jsx("span", { children: t("core.form.commented") }),
                    /* @__PURE__ */ jsx("span", { className: "mx-2 text-muted-foreground", children: "●" }),
                    /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: format(new TZDate(created_at, "UTC"), "PPPp", {
                      locale: getLocaleDate(lang)
                    }) })
                  ] }),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      variant: "ghost",
                      size: "icon",
                      className: "p-0! hover:text-red-500",
                      onClick: () => removeComment(id),
                      children: /* @__PURE__ */ jsx(Trash2, {})
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx("div", { className: "[&_pre]:font-sans! col-start-2 pt-2 **:text-sm  font-normal text-foreground ql-container ql-bubble font-sans! [&_a]:underline-offset-2 [&_a]:hover:underline", children: /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "ql-editor p-0!",
                    dangerouslySetInnerHTML: {
                      __html: activity
                    }
                  }
                ) })
              ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("time", { className: "mb-1 text-xs font-normal leading-none text-muted-foreground", children: /* @__PURE__ */ jsx("span", { children: format(new TZDate(created_at, "UTC"), "PPPp", {
                  locale: getLocaleDate(lang)
                }) }) }),
                /* @__PURE__ */ jsx("div", { className: "[&_pre]:font-sans! col-start-2 pt-0 **:text-sm font-normal text-foreground ql-container ql-bubble font-sans! [&_a]:underline-offset-2 [&_a]:hover:underline", children: /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: "ql-editor p-0! hover:[&_*[role=noeditor]]:underline! [&_*[role=noeditor]]:no-underline! [&_*[role=noeditor]]:after:content-none! [&_*[role=noeditor]]:before:content-none!",
                    dangerouslySetInnerHTML: {
                      __html: activity[lang].replace(
                        ":user",
                        `<a role="noeditor" href="${route("users.show", user2.id)}" rel="noopener noreferrer" target="_blank" >${user2.name}</a>`
                      )
                    }
                  }
                ) }),
                data_after && /* @__PURE__ */ jsx(
                  Link,
                  {
                    className: "hover:underline text-blue-400 text-sm",
                    href: route("logs.show", id),
                    children: t("core.form.show_diff")
                  }
                )
              ] })
            ] }, id)
          )
        }
      ) })
    ] })
  ] });
});
export {
  Comments as default
};
