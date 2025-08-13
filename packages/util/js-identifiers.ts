export const VALID_JS_ID = /^[$_a-z][$_a-z0-9]*$/i;

export const NORMAL_JS_KEY = /^[$_a-z0-9]+$/i;

export function compileJsKey(key: string) {
  return NORMAL_JS_KEY.test(key) ? key : JSON.stringify(key);
}
