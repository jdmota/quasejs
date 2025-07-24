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
