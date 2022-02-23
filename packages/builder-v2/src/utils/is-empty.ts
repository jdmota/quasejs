export default function isEmpty(obj: object): boolean {
  if (obj) {
    for (const _name in obj) {
      return false;
    }
  }
  return true;
}
