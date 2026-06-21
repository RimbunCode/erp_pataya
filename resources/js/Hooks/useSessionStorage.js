import { useCallback, useState } from "react";

export function useSessionStorage(key, defaultValue) {
    const [value, setValue] = useState(() => {
        try {
            const item = sessionStorage.getItem(key);
            return item !== null ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    const set = useCallback(
        (newValue) => {
            try {
                setValue(newValue);
                sessionStorage.setItem(key, JSON.stringify(newValue));
            } catch {
                // sessionStorage tidak tersedia (private mode, storage penuh, dll)
            }
        },
        [key],
    );

    return [value, set];
}
