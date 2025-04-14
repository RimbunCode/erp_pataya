import { forwardRef, memo } from "react";

import DiffMatchPatch from "diff-match-patch";

export default memo(
  forwardRef(function StrikethroughDiff({ oldText, newText, ...props }, ref) {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);

    return (
      <span ref={ref} {...props}>
        {diffs.map(([type, text], index) => {
          if (type === -1) {
            // Teks lama (dihapus) -> coret
            return (
              <span key={index} className="line-through text-red-500">
                {text}
              </span>
            );
          } else if (type === 1) {
            // Teks baru (ditambahkan) -> warna hijau
            return (
              <span key={index} className="text-green-500 font-bold">
                {text}
              </span>
            );
          }
          return <span key={index}>{text}</span>; // Teks yang tidak berubah
        })}
      </span>
    );
  }),
);
