import { Children, cloneElement } from "react";
import { enUS, id as idLocale } from "date-fns/locale";
import {
  every,
  isArray,
  isEmpty,
  isNull,
  isPlainObject,
  isUndefined,
} from "lodash";

import { Buffer } from "buffer";
import axios from "axios";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
export function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
  );
}

export const checkUrlPath = (pathPatern) => {
  const currentPath = window.location.pathname;
  if (pathPatern === currentPath) {
    return true;
  }

  const patern = "^"
    .concat(pathPatern)
    .replaceAll("/**", "/.*")
    .replaceAll("/*/", "/[^/]*/")
    .replaceAll("/*", "/.*")
    .replaceAll("/", "\\/?")
    .concat("$");

  const rgx = new RegExp(patern, "g");
  return currentPath.search(rgx) >= 0;
};
export function mergeRefs(...inputRefs) {
  return (ref) => {
    inputRefs.forEach((inputRef) => {
      if (!inputRef) {
        return;
      }

      if (typeof inputRef === "function") {
        inputRef(ref);
      } else {
        inputRef.current = ref;
      }
    });
  };
}
export function generateRandom(length, includeSpecial = false) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  if (includeSpecial) {
    characters += "!@#$%^&*()_+-=[]{}|;':\",./<>?";
  }
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export function isNullOrWhitespace(input) {
  if (typeof input === "undefined" || input == null) return true;

  return input.replace(/\s/g, "").length < 1;
}

export const SingleChildContainer = ({ children, ...props }) => {
  return cloneElement(Children.only(children), {
    ...props,
  });
};
export function toSnakeCase(text) {
  return text
    .replace(/\s+/g, "_") // ubah spasi jadi underscore
    .replace(/([a-z])([A-Z])/g, "$1_$2") // pisahkan camelCase -> camel_Case
    .replace(/-+/g, "_") // ubah dash jadi underscore
    .toLowerCase(); // semuanya jadi lowercase
}

export function cleanedQuillOutput(str) {
  const route = window.route;
  str = str.replace(/href="(?!https?:\/\/)([^"]*)"/g, 'href="https://$1"');
  str = str.replace(
    /<span([^>]*)data-id="([^"]+)"([^>]*)data-value="([^"]+)"([^>]*)>.*?<\/span>/g,
    `<a$1 data-id="$2"$3 data-value="$4"$5 href="${route("users.index")}/$2" target="_blank" rel="noreferrer">@\$4</a>`,
  );
  const list = str.split("<p>");

  let startIndex = 0;
  let endIndex = 0;
  for (let i = 0; i < list.length; i++) {
    startIndex = i;
    let str = list[i].replace("</p>", "").trimStart();
    if (isNullOrWhitespace(str) || str == "<br>") continue;
    break;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    endIndex = i;
    let str = list[i].replace("</p>", "").trimStart();
    if (isNullOrWhitespace(str) || str == "<br>") continue;
    break;
  }

  return list
    .slice(startIndex, endIndex + 1)
    .map((item, index) => {
      const newStr = item.replace("</p>", "");
      if (index == 0) {
        return "<pre>" + newStr.trimStart() + "</pre>";
      }
      return "<pre>" + newStr + "</pre>";
    })
    .join("");
}
export function getCookieByName(name) {
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}
export function removeCookie(name, path) {
  setCookie(name, "", {
    days: -1,
    path: path,
  });
}
export function setCookie(name, value, { days = 1, path = "/", sameSite }) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  let cookie = `${name}=${value}${expires}; path=${path}`;
  if (sameSite) {
    cookie += `; SameSite=${sameSite}`;
  }

  document.cookie = cookie;
}
export const saveToLocalStorage = (key, data, expiredDays) => {
  const jsonString = JSON.stringify(data);
  const base64 = Buffer.from(jsonString).toString("base64");
  localStorage.setItem(
    key,
    JSON.stringify({
      // pathname: window.location.pathname,
      expiredDate: expiredDays
        ? new Date(Date.now() + expiredDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
      updatedAt: new Date().toISOString(),
      data: base64,
    }),
  );
};
export const getFromLocalStorage = (key) => {
  // key = `${window.location.pathname}/${key}`;
  let dataCookie = localStorage.getItem(key);
  if (dataCookie != null) {
    if (typeof dataCookie === "string") {
      try {
        dataCookie = JSON.parse(dataCookie);
      } catch (e) {
        console.error("Error parsing cookie data:", e);
        return;
      }
    }
    // if (dataCookie.pathname !== window.location.pathname) {
    //   // console.log("Cookie data does not match current path, ignoring.");
    //   return;
    // }
    if (
      dataCookie.expiredDate &&
      new Date(dataCookie.expiredDate) < new Date(Date.now())
    ) {
      localStorage.removeItem(key);
      // removeCookie(key, window.location.pathname);
      return;
    }
    const jsonString = Buffer.from(dataCookie.data, "base64").toString();
    return JSON.parse(jsonString);
  }
  return null;
};
export const removeFromLocalStorage = (key) => {
  // key = `${window.location.pathname}/${key}`;
  localStorage.removeItem(key);
};
export const checkFileType = (patternType, fileType) => {
  const patern = "^"
    .concat(patternType)
    .replaceAll("/**", "/.*")
    .replaceAll("/*/", "/[^/]*/")
    .replaceAll("/*", "/.*")
    .replaceAll("/", "\\/?")
    .concat("$");

  const rgx = new RegExp(patern, "g");
  return rgx.test(fileType);
};

export function getLocaleDate(locale) {
  switch (locale) {
    case "id":
      return idLocale;
    default:
      return enUS;
  }
}

export function getValueObject(obj, key) {
  const keys = key.split(".");
  const newValue = keys.reduce((x, y) => x[y], obj);
  return newValue;
}

export function isValidStatus(status) {
  return !inArray(status, [
    "draft",
    "canceled",
    "rejected",
    "deleted",
    "closed",
    "need_approval",
    "inactive",
  ]);
}

export function isCompletedStatus(status) {
  return inArray(status, ["completed", "done", "delivered", "billed"]);
}

export function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

export function isDeepEmpty(value) {
  if (isUndefined(value)) return true;
  if (isNull(value)) return true;

  // Cek array
  if (isArray(value)) {
    return value.length === 0 || every(value, isDeepEmpty);
  }

  // Cek object
  if (isPlainObject(value)) {
    return isEmpty(value) || every(value, (v) => isDeepEmpty(v));
  }

  // Selain itu dianggap "ada nilai"
  return false;
}

export function inArray(haystack, needles) {
  let found = false;
  for (let i in haystack) {
    if (Array.isArray(needles)) {
      for (let j in needles) {
        if (haystack[i] == needles[j]) {
          found = true;
          break;
        }
      }
      if (found) break;
      continue;
    }
    if (haystack[i] == needles) {
      found = true;
      break;
    }
  }

  return found;
}

export const calculateArray = (arr, keyColumn, operator) => {
  if (!(keyColumn && operator)) return 0;
  const length = arr?.length ?? 0;
  let operatorIn = operator;
  if (operator === "average") operatorIn = "+";
  const result = arr
    ? arr?.reduce((a, b) => {
        if (typeof a === "object") a = a[keyColumn] ?? 0;
        b = b[keyColumn] ?? 0;
        switch (operatorIn) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return a / b;
          case "%":
            return a % b;
          case "^":
            return a ** b;
          case "&&":
            return a && b;
          case "||":
            return a || b;
          default:
            return 0;
        }
      }, 0)
    : 0;
  if (operator === "average") return length != 0 ? result / length : 0;
  return result;
};
export const DEFAULT_PRINT_FONTS = Object.freeze([
  "Times New Roman",
  "Arial",
  "Helvetica",
  "Segoe UI",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Garamond",
  "Cambria",
  "Courier New",
  "Roboto",
  "Noto Sans",
  "Noto Serif",
]);

const normalizeFontName = (font) => {
  if (typeof font !== "string") {
    return "";
  }
  return font.trim();
};

const dedupeFonts = (fonts = []) => {
  const map = new Map();
  fonts.forEach((font) => {
    const normalized = normalizeFontName(font);
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (!map.has(key)) {
      map.set(key, normalized);
    }
  });
  return Array.from(map.values());
};

const inferGenericFontFamily = (fontFamily = "") => {
  const value = fontFamily.toLowerCase();
  if (/mono|courier|consolas|menlo|code|terminal|source code/.test(value)) {
    return "monospace";
  }
  if (
    /serif|times|georgia|garamond|cambria|palatino|book antiqua/.test(value)
  ) {
    return "serif";
  }
  return "sans-serif";
};

export const getSafePrintFontFamily = (fontFamily, genericFamily) => {
  const normalized = normalizeFontName(fontFamily);
  const fallback = genericFamily ?? inferGenericFontFamily(normalized);
  if (!normalized) {
    return fallback;
  }

  const escaped = normalized.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${escaped}', ${fallback}`;
};

export const getFonts = async () => {
  const fallbackFonts = [...DEFAULT_PRINT_FONTS];
  if (
    typeof window === "undefined" ||
    typeof window.queryLocalFonts !== "function"
  ) {
    return fallbackFonts;
  }

  try {
    const availableFonts = await window.queryLocalFonts();
    const localFonts = dedupeFonts(
      Array.from(availableFonts).map((font) => font?.family ?? ""),
    );
    const fallbackSet = new Set(
      fallbackFonts.map((font) => font.toLowerCase()),
    );
    const additionalFonts = localFonts
      .filter((font) => !fallbackSet.has(font.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    return [...fallbackFonts, ...additionalFonts];
  } catch (err) {
    console.error(err.name, err.message);
    return fallbackFonts;
  }
};

/**
 * Mengambil data model melalui route "model".
 * @param {string} model
 * @param {Record<string, unknown>} filters
 * @typedef {object} DataModelOptions
 * @property {number=} limit jika 1 maka hanya mengembalikan satu item
 * @param {DataModelOptions & Record<string, unknown>} [options] opsi tambahan (default `{}`)
 * @returns {Promise<Record<string, unknown> | Array<Record<string, unknown>>>}
 */
export const getDataModel = async (model, filters, options = {}) => {
  const result = await axios.post(window.route("model"), {
    model,
    filters,
    ...options,
  });
  const data = result?.data?.data;
  return options.limit == 1 ? data[0] : data;
};
/**
 * Mengecek izin aksi pada model di level tertentu.
 * @param {Record<string, Record<number, Array<{ only_creator: boolean, permissions: Record<string, boolean> }>>>} permissions
 * @param {string} model
 * @param {string} action
 * @param {number} [level] level akses (default 0)
 * @returns {{ allowed: boolean, onlyCreator: boolean }}
 */
export function checkPermission(permissions, model, action, level = 0) {
  const modelPermissions = permissions[model];
  const levelPermissions = modelPermissions ? modelPermissions[level] : null;
  if (!levelPermissions) return { allowed: false, onlyCreator: false };

  let allowed = false;
  let onlyCreator = false;
  for (let levelPermission of Object.values(levelPermissions) ?? []) {
    if (levelPermission.only_creator && levelPermission.permissions[action]) {
      allowed = true;
      onlyCreator = true;
    } else if (
      !levelPermission.only_creator &&
      levelPermission.permissions[action]
    ) {
      allowed = true;
      onlyCreator = false;
    }
  }

  return { allowed, onlyCreator };
}
