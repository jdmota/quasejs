import { noop } from "../util/miscellaneous";

export function onEnter(fn: () => void) {
  return (evt: KeyboardEvent) => {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      fn();
    }
  };
}

export const goTop =
  typeof scrollTo === "undefined" ? noop : () => scrollTo(0, 0);

export function goTopSmooth() {
  document.body.scrollIntoView({ behavior: "smooth" });
}
