import { createElement, Fragment, memo, useMemo } from "react";
import { domToReact, htmlToDOM } from "html-react-parser";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { highlightText } from "./highlight";
import usePageProps from "./usePageProps";
import { InsideLinkContext } from "./tags/linkContext";
import { getTagComponent, tagNeedsData, TAG_ATTRS } from "./tags";
import {
  ALLOWED_ATTRS,
  BASIC_TAGS,
  SEMANTIC_TAGS,
  fillAttrs,
  fillPlaceholders,
  prepareTemplate,
} from "./templateEngine";

const BASIC_TAG_SET = new Set(BASIC_TAGS);
const SEMANTIC_TAG_SET = new Set(SEMANTIC_TAGS);
const VOID_BASIC_TAGS = new Set(["br"]);

/** Elemen yang dibuang beserta seluruh isinya (bukan hanya tag-nya). */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "title",
]);

// Parse HTML -> DOM hanya SEKALI per string template (hasil `prepareTemplate`);
// tiap baris hanya menjalankan `domToReact` di atas DOM ter-cache itu. DOM tidak
// pernah dimutasi (traversal hanya membaca `node.attribs`/`children`).
const DOM_CACHE_LIMIT = 1000;
const domCache = new Map();
const DOM_PARSER_OPTIONS = { lowerCaseAttributeNames: false };

/**
 * @param {string} safe template tersanitasi
 * @returns {import("domhandler").ChildNode[]}
 */
function getTemplateDom(safe) {
  let dom = domCache.get(safe);
  if (dom === undefined) {
    dom = htmlToDOM(safe, DOM_PARSER_OPTIONS);
    if (domCache.size >= DOM_CACHE_LIMIT) {
      domCache.clear();
    }
    domCache.set(safe, dom);
  }

  return dom;
}

/**
 * Atribut template (setelah placeholder diisi) -> props React. Hanya atribut
 * allowlist; `href`, `style`, `on*`, dll. tidak pernah diteruskan. Nilai
 * placeholder masuk sebagai string prop sehingga di-escape oleh React.
 * @param {Record<string, string>} attribs
 * @param {object} row
 * @param {object|undefined} column
 * @param {object} ctx
 * @param {boolean} semantic true = teruskan atribut khusus tag semantik
 * @returns {Record<string, string>}
 */
function toProps(attribs, row, column, ctx, semantic) {
  const filled = fillAttrs(attribs, row, column, ctx);
  const props = {};
  if (filled.class) {
    props.className = filled.class;
  }
  if (semantic) {
    for (const key of TAG_ATTRS) {
      if (ALLOWED_ATTRS.includes(key) && filled[key] !== undefined) {
        props[key] = filled[key];
      }
    }
  }

  return props;
}

/**
 * Opsi `html-react-parser`: tag semantik -> komponen, node teks -> placeholder
 * terisi + sorotan, tag dasar -> elemen dengan atribut tersaring. Allowlist
 * ditegakkan lagi di sini (lapisan kedua setelah `prepareTemplate`): elemen di
 * luar allowlist dibuang (anak teks dipertahankan), komentar dibuang.
 * @param {{ row: object, column?: object, ctx: object, search?: string }} state
 * @returns {import("html-react-parser").HTMLReactParserOptions}
 */
function buildOptions({ row, column, ctx, search }) {
  const options = {
    replace(node) {
      if (node.type === "text") {
        return (
          <Fragment>
            {highlightText(
              fillPlaceholders(node.data, row, column, ctx),
              search,
            )}
          </Fragment>
        );
      }
      if (node.type === "comment" || node.type === "directive") {
        return <Fragment />;
      }
      if (node.type !== "tag") {
        // script / style (dan tipe lain): dibuang total.
        return <Fragment />;
      }

      const name = String(node.name).toLowerCase();
      if (DROP_WITH_CONTENT.has(name)) {
        return <Fragment />;
      }

      if (SEMANTIC_TAG_SET.has(name)) {
        const Tag = getTagComponent(name);
        if (!Tag) {
          return <Fragment>{domToReact(node.children, options)}</Fragment>;
        }
        // Isi <mark> tidak disorot lagi oleh pencarian (hindari <mark> bersarang).
        const childOptions =
          name === "mark" && search
            ? buildOptions({ row, column, ctx, search: undefined })
            : options;
        const props = toProps(node.attribs, row, column, ctx, true);
        if (tagNeedsData(name)) {
          props.row = row;
          props.column = column;
        }

        return <Tag {...props}>{domToReact(node.children, childOptions)}</Tag>;
      }

      if (BASIC_TAG_SET.has(name)) {
        const props = toProps(node.attribs, row, column, ctx, false);
        if (VOID_BASIC_TAGS.has(name)) {
          return createElement(name, props);
        }

        return createElement(name, props, domToReact(node.children, options));
      }

      // Tag lain: buang elemen, pertahankan isinya.
      return <Fragment>{domToReact(node.children, options)}</Fragment>;
    },
  };

  return options;
}

/**
 * Renderer bersama template HTML terbatas + placeholder + tag semantik.
 *
 * Template disanitasi allowlist LEBIH DULU (`prepareTemplate`), lalu diparsing;
 * nilai data diisi sesudahnya sebagai teks/prop React, tidak pernah diparsing
 * sebagai HTML.
 * @param {object} props
 * @param {string} [props.template] template (placeholder, tag semantik)
 * @param {object} props.row baris data sumber placeholder
 * @param {object} [props.column] kolom pemilik template (valueTrans, badgeColors, route, ...)
 * @param {"cell"|"option"|"chip"|"mobile"|"selected"} [props.context] "cell" default;
 *   selain "selected", `<title>` dibuang
 * @param {string} [props.search] kata pencarian untuk sorotan `<mark>`
 * @returns {JSX.Element|null}
 */
function SemanticTemplate({ template, row, column, context = "cell", search }) {
  const { lang, preferences } = usePageProps();
  const { t } = useLaravelReactI18n();

  const safe = useMemo(
    () => prepareTemplate(template, row, { context }),
    [template, row, context],
  );
  const rendered = useMemo(() => {
    if (!safe) {
      return null;
    }

    return domToReact(
      getTemplateDom(safe),
      buildOptions({
        row,
        column,
        ctx: { t, lang, preferences },
        search,
      }),
    );
  }, [safe, row, column, search, t, lang, preferences]);

  // Opsi dropdown (LinkModel/SelectModel): klik opsi = MEMILIH, bukan navigasi,
  // jadi <nav-link>/<chips> di dalamnya dirender tanpa <a>.
  if (context === "option") {
    return (
      <InsideLinkContext.Provider value={true}>
        {rendered}
      </InsideLinkContext.Provider>
    );
  }

  return <>{rendered}</>;
}

export default memo(SemanticTemplate);
