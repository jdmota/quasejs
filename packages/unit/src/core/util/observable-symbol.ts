export default function () {
  if (typeof Symbol === "function" && Symbol.observable) {
    return Symbol.observable;
  }
  return "@@observable";
}
