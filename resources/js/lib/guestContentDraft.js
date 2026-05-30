export function parsePath(path) {
  return String(path)
    .split(".")
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

export function getByPath(objectValue, path) {
  return parsePath(path).reduce((currentValue, segment) => {
    if (currentValue == null) {
      return undefined;
    }

    return currentValue[segment];
  }, objectValue);
}

export function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        cloneValue(entryValue),
      ]),
    );
  }

  return value;
}

export function setByPath(objectValue, path, nextValue) {
  const segments = parsePath(path);
  const nextObject = cloneValue(objectValue);

  let cursor = nextObject;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];

    if (cursor[segment] == null) {
      cursor[segment] = typeof nextSegment === "number" ? [] : {};
    }

    cursor = cursor[segment];
  }

  cursor[segments[segments.length - 1]] = nextValue;

  return nextObject;
}

export function addListItemByPath(objectValue, path, item) {
  const list = getByPath(objectValue, path);
  const currentList = Array.isArray(list) ? list : [];

  return setByPath(objectValue, path, [...currentList, item]);
}

export function removeListItemByPath(objectValue, path, indexToRemove) {
  const list = getByPath(objectValue, path);
  const currentList = Array.isArray(list) ? list : [];

  const nextList = currentList.filter(
    (_entryValue, index) => index !== indexToRemove,
  );

  return setByPath(objectValue, path, nextList);
}
