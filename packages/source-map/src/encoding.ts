const win = typeof window !== "undefined" && window; // eslint-disable-line

const encoding = {
  encode: win ? win.btoa : (str: string) => Buffer.from(str).toString("base64"),
  decode: win
    ? win.atob
    : (str: string) => Buffer.from(str, "base64").toString(),
};

export default encoding;
