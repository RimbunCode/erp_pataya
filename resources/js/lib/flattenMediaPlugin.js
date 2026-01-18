// flattenMediaPlugin.js
export default function flattenMediaPlugin(
  editor,
  { stripOnStore = true } = {},
) {
  const MEDIA_RE = /@media[^{]+\{([\s\S]*?)\}\s*/g;

  const stripMedia = (css) =>
    typeof css === "string" ? css.replace(MEDIA_RE, "$1") : css;

  const bindRuntimeScrubber = () => {
    const frame = editor.Canvas.getFrameEl?.();
    const doc = frame?.contentDocument || frame?.contentWindow?.document;
    if (!doc) return () => {};

    // 1) Scrub semua <style> di canvas
    const scrubAll = () => {
      const styles = doc.querySelectorAll("style");
      styles.forEach((node) => {
        const before = node.textContent || "";
        const after = stripMedia(before);
        if (after !== before) node.textContent = after;
      });
    };

    // Jalankan sekali saat load
    scrubAll();

    // 2) Observe perubahan pada <head>/<style> agar otomatis di-scrub
    const obs = new MutationObserver(() => scrubAll());
    obs.observe(doc.head || doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    // 3) Hubungkan dengan event GrapesJS yang memicu update style
    const rerun = () => scrubAll();
    editor.on("component:styleUpdate", rerun);
    editor.on("styleManager:change", rerun);
    editor.on("change:device", rerun);
    editor.on("canvas:frame:load", () => {
      // kalau frame reload, rebind
      setTimeout(() => {
        obs.disconnect();
        bindRuntimeScrubber();
      }, 0);
    });

    // cleanup
    return () => {
      obs.disconnect();
      editor.off("component:styleUpdate", rerun);
      editor.off("styleManager:change", rerun);
      editor.off("change:device", rerun);
    };
  };

  editor.on("load", () => {
    // Pasang runtime scrubber
    const unbind = bindRuntimeScrubber();
    editor.once("destroy", () => unbind && unbind());
  });

  if (stripOnStore) {
    // Safety-net saat menyimpan via StorageManager
    const sm = editor.getConfig()?.storageManager;
    if (sm) {
      const userOnStore = sm.onStore;
      sm.onStore = (data, ed) => {
        const out = userOnStore ? userOnStore(data, ed) : data;

        // Contoh: kamu menyimpan pagesHtml [{ html, css }]
        if (Array.isArray(out?.pagesHtml)) {
          out.pagesHtml = out.pagesHtml.map((p) => ({
            ...p,
            css: stripMedia(p.css),
          }));
        }
        // Kalau ada payload css lain, bersihkan juga
        if (out?.data?.css) out.data.css = stripMedia(out.data.css);

        return out;
      };
    }
  }
}
