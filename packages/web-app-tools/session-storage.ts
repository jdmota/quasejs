export function sessionGet(key: string) {
  try {
    const value = sessionStorage.getItem(key);
    return value == null ? value : JSON.parse(value);
  } catch (error) {
    // Ignore
  }
}

export function sessionSet(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore
  }
}
