import { noop } from "./utils";

export function onEnter(fn: () => void) {
  return (evt: KeyboardEvent) => {
    if (evt.key === "Enter" || evt.keyCode === 13) {
      fn();
    }
  };
}

export const scrollToTop =
  typeof scrollTo === "undefined" ? noop : () => scrollTo(0, 0);
