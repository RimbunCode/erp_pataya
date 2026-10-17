import { createContext } from "react";

/**
 * true bila sedang di dalam tautan (<nav-link> / <a>) sehingga tautan bersarang
 * dirender tanpa `<a>` (hindari anchor di dalam anchor).
 */
export const InsideLinkContext = createContext(false);
