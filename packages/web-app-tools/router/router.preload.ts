import { TypedEvent } from "../events";
import { SimpleLocationNoHash, createSimpleLocationNoHash } from "./pathname";
import { findAnchor, considerAnchor } from "./anchors";
import { RouterEvents, RouterMixin, Router } from "./router";

// Adapted from https://github.com/sveltejs/kit
/*
"eager" means that links will be preloaded straight away
"viewport" means that links will be preloaded once they enter the viewport
"hover" means that preloading will start if the mouse comes to a rest over a link. On mobile, preloading begins on touchstart
"tap" means that preloading will start as soon as a touchstart or mousedown event is registered
*/
type PreloadStrategy = "eager" | "viewport" | "hover" | "tap";

function setupPreload<E extends RouterEvents>(
  router: Router<E>,
  strategy: PreloadStrategy,
  notify: (anchor: HTMLAnchorElement) => void
) {
  const container = document.body;
  let mousemoveTimeout: number | NodeJS.Timeout = 0;

  function hover(event: Event) {
    clearTimeout(mousemoveTimeout);
    mousemoveTimeout = setTimeout(() => preload(event), 20);
  }

  function preload(event: Event) {
    const anchor = findAnchor(event);
    if (anchor) {
      notify(anchor);
    }
  }

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          notify(entry.target as HTMLAnchorElement);
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0 }
  );

  function afterNavigate() {
    observer.disconnect();

    //@ts-expect-error
    for (const a of container.querySelectorAll("a")) {
      if (considerAnchor(a)) {
        if (strategy === "viewport") {
          observer.observe(a);
        } else if (strategy === "eager") {
          notify(a);
        }
      }
    }
  }

  if (strategy === "hover") {
    container.addEventListener("mousemove", hover);
    container.addEventListener("touchstart", preload, { passive: true });
  } else if (strategy === "tap") {
    container.addEventListener("mousedown", preload);
    container.addEventListener("touchstart", preload, { passive: true });
  } else if (strategy === "viewport" || strategy === "eager") {
    router.addEventListener("ready", afterNavigate);
    router.addEventListener("navigation", afterNavigate);
  }

  return () => {
    container.removeEventListener("mousemove", hover);
    container.removeEventListener("mousedown", preload);
    container.removeEventListener("touchstart", preload);
    router.removeEventListener("ready", afterNavigate);
    router.removeEventListener("navigation", afterNavigate);
    observer.disconnect();
  };
}

export type PreloadEvents = {
  readonly preload: SimpleLocationNoHash;
};

export type PreloadOpts = {
  readonly preload: PreloadStrategy | false;
};

export class PreloadMixin<
  E extends PreloadEvents & RouterEvents
> extends RouterMixin<E> {
  private opts: PreloadOpts;

  constructor(router: Router<E>, opts: PreloadOpts) {
    super(router);
    this.opts = opts;
  }

  override clientInstall(): void {
    if (this.opts.preload) {
      setupPreload(this.router, this.opts.preload, anchor => {
        this.router.dispatchEvent(
          new TypedEvent("preload", createSimpleLocationNoHash(anchor))
        );
      });
    }
  }
}
