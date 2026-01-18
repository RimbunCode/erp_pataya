import "react";
import { enUS, id } from "date-fns/locale";
import { isUndefined, isNull, isArray, every, isPlainObject, isEmpty } from "lodash";
import { Buffer } from "buffer";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}
const checkUrlPath = (pathPatern) => {
  const currentPath = window.location.pathname;
  if (pathPatern === currentPath) {
    return true;
  }
  const patern = "^".concat(pathPatern).replaceAll("/**", "/.*").replaceAll("/*/", "/[^/]*/").replaceAll("/*", "/.*").replaceAll("/", "\\/?").concat("$");
  const rgx = new RegExp(patern, "g");
  return currentPath.search(rgx) >= 0;
};
function mergeRefs(...inputRefs) {
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
function generateRandom(length) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
function isNullOrWhitespace(input) {
  if (typeof input === "undefined" || input == null) return true;
  return input.replace(/\s/g, "").length < 1;
}
function cleanedQuillOutput(str) {
  const route = window.route;
  str = str.replace(/href="(?!https?:\/\/)([^"]*)"/g, 'href="https://$1"');
  str = str.replace(
    /<span([^>]*)data-id="([^"]+)"([^>]*)data-value="([^"]+)"([^>]*)>.*?<\/span>/g,
    `<a$1 data-id="$2"$3 data-value="$4"$5 href="${route("users.index")}/$2" target="_blank" rel="noreferrer">@$4</a>`
  );
  const list = str.split("<p>");
  let startIndex = 0;
  let endIndex = 0;
  for (let i = 0; i < list.length; i++) {
    startIndex = i;
    let str2 = list[i].replace("</p>", "").trimStart();
    if (isNullOrWhitespace(str2) || str2 == "<br>") continue;
    break;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    endIndex = i;
    let str2 = list[i].replace("</p>", "").trimStart();
    if (isNullOrWhitespace(str2) || str2 == "<br>") continue;
    break;
  }
  return list.slice(startIndex, endIndex + 1).map((item, index) => {
    const newStr = item.replace("</p>", "");
    if (index == 0) {
      return "<pre>" + newStr.trimStart() + "</pre>";
    }
    return "<pre>" + newStr + "</pre>";
  }).join("");
}
function getCookieByName(name) {
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}
function removeCookie(name, path) {
  setCookie(name, "", {
    days: -1,
    path
  });
}
function setCookie(name, value, { days = 1, path = "/", sameSite }) {
  let expires = "";
  if (days) {
    const date = /* @__PURE__ */ new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1e3);
    expires = "; expires=" + date.toUTCString();
  }
  let cookie = `${name}=${value}${expires}; path=${path}`;
  if (sameSite) {
    cookie += `; SameSite=${sameSite}`;
  }
  document.cookie = cookie;
}
const saveToLocalStorage = (key, data, expiredDays) => {
  const jsonString = JSON.stringify(data);
  const base64 = Buffer.from(jsonString).toString("base64");
  localStorage.setItem(
    key,
    JSON.stringify({
      // pathname: window.location.pathname,
      expiredDate: expiredDays ? new Date(Date.now() + expiredDays * 24 * 60 * 60 * 1e3).toISOString() : null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      data: base64
    })
  );
};
const getFromLocalStorage = (key) => {
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
    if (dataCookie.expiredDate && new Date(dataCookie.expiredDate) < new Date(Date.now())) {
      localStorage.removeItem(key);
      return;
    }
    const jsonString = Buffer.from(dataCookie.data, "base64").toString();
    return JSON.parse(jsonString);
  }
  return null;
};
const removeFromLocalStorage = (key) => {
  localStorage.removeItem(key);
};
const checkFileType = (patternType, fileType) => {
  const patern = "^".concat(patternType).replaceAll("/**", "/.*").replaceAll("/*/", "/[^/]*/").replaceAll("/*", "/.*").replaceAll("/", "\\/?").concat("$");
  const rgx = new RegExp(patern, "g");
  return rgx.test(fileType);
};
function getLocaleDate(locale) {
  switch (locale) {
    case "id":
      return id;
    default:
      return enUS;
  }
}
function getValueObject(obj, key) {
  const keys = key.split(".");
  const newValue = keys.reduce((x, y) => x[y], obj);
  return newValue;
}
function isValidStatus(status) {
  return !inArray(status, [
    "draft",
    "canceled",
    "rejected",
    "deleted",
    "closed",
    "need_approval",
    "inactive"
  ]);
}
function isCompletedStatus(status) {
  return inArray(status, ["completed", "done", "delivered", "billed"]);
}
function camelize(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, "");
}
function isDeepEmpty(value) {
  if (isUndefined(value)) return true;
  if (isNull(value)) return true;
  if (isArray(value)) {
    return value.length === 0 || every(value, isDeepEmpty);
  }
  if (isPlainObject(value)) {
    return isEmpty(value) || every(value, (v) => isDeepEmpty(v));
  }
  return false;
}
function inArray(haystack, needles) {
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
const calculateArray = (arr, keyColumn, operator) => {
  if (!(keyColumn && operator)) return 0;
  const length = (arr == null ? void 0 : arr.length) ?? 0;
  let operatorIn = operator;
  if (operator === "average") operatorIn = "+";
  const result = arr ? arr == null ? void 0 : arr.reduce((a, b) => {
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
  }, 0) : 0;
  if (operator === "average") return length != 0 ? result / length : 0;
  return result;
};
const getFonts = async () => {
  try {
    const availableFonts = await window.queryLocalFonts();
    const list = Array.from(availableFonts).map((font) => font.family);
    return [...new Set(list)];
  } catch (err) {
    console.error(err.name, err.message);
    return [];
  }
};
export {
  getLocaleDate as a,
  getFromLocalStorage as b,
  cn as c,
  camelize as d,
  getValueObject as e,
  isNullOrWhitespace as f,
  getFonts as g,
  checkFileType as h,
  isDeepEmpty as i,
  formatBytes as j,
  generateRandom as k,
  inArray as l,
  isCompletedStatus as m,
  getCookieByName as n,
  checkUrlPath as o,
  cleanedQuillOutput as p,
  setCookie as q,
  removeFromLocalStorage as r,
  saveToLocalStorage as s,
  mergeRefs as t,
  removeCookie as u,
  calculateArray as v,
  isValidStatus as w,
  getRandomInt as x
};
