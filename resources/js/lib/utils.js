import { Children, cloneElement } from "react";
import { enUS, id as idLocale } from "date-fns/locale";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
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
export function generateRandom(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
