import React, { useRef } from "react";

function useDynamicRefs() {
  const map = useRef(new Map()).current;

  function setRef(key) {
    if (!key)
      return console.warn(`useDynamicRefs: Cannot set ref without key `);
    const ref = React.createRef();
    map.set(key, ref);
    return ref;
  }

  function getRef(key) {
    if (!key) return console.warn(`useDynamicRefs: Cannot get ref without key`);
    return map.get(key);
  }

  return [getRef, setRef];
}

export default useDynamicRefs;
