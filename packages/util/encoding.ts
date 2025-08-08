const win = typeof window !== "undefined" && window;

export const encodeBase64 = win
  ? win.btoa
  : (str: string) => Buffer.from(str).toString("base64");

export const decodeBase64 = win
  ? win.atob
  : (str: string) => Buffer.from(str, "base64").toString();
