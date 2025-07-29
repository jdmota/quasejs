export function onLoad() {
  return new Promise<void>(resolve => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      const fn = () => {
        window.removeEventListener("load", fn);
        resolve();
      };
      window.addEventListener("load", fn);
    }
  });
}

export function onMount(svelteOnMount: (resolve: () => void) => void) {
  return new Promise<void>(svelteOnMount);
}
