// [min, max[
export function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min));
}

// Based on https://stackoverflow.com/questions/1349404/generate-a-string-of-random-characters

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randString(length: number, chars = CHARS) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(randInt(0, chars.length));
  }
  return result;
}

// From https://stackoverflow.com/a/12646864
export function shuffleArray<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    let tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
