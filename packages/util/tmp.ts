function n(n: number) {
  return n < 10 ? "0" + n : "" + n;
}

export function timestamp(d = new Date()) {
  return `${d.getFullYear()}${n(d.getMonth() + 1)}${n(d.getDate())}${n(d.getHours())}${n(d.getMinutes())}${n(d.getSeconds())}`;
}
