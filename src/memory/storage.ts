export const safeGetItem = (key: string) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
};

export const safeSetItem = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
};

export const safeRemoveItem = (key: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
};
