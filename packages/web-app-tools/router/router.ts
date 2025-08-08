// TODO preload when hovering anchors?

// TODO deal with focus
// svelte/kit
// https://github.com/mefechoel/svelte-navigator/blob/main/src/a11y.js

// TODO on ready/navigation, we have to scroll and deal with focus

// TODO https://github.com/remix-run/react-router/blob/main/docs/components/scroll-restoration.md
// TODO support state and key (based on index)
// TODO https://codepen.io/morten-olsen/post/when-safari-broke-webapps

import { never, type Optional } from "../../util/miscellaneous";
import { TypedEvent, TypedEventTarget } from "../events";
import { findAnchor } from "./anchors";
import {
  createSimpleLocation,
  sameSimpleLocation,
  simpleLocationToHref,
  type RawSimpleLocation,
  type SimpleLocation,
} from "./pathname";

const INDEX_KEY = "quase_router_index";

function pushNavigation(target: SimpleLocation) {
  const newHref = simpleLocationToHref(target);
  window.history.pushState({}, "", newHref);
}

function replaceNavigation(target: SimpleLocation) {
  const newHref = simpleLocationToHref(target);
  window.history.replaceState({}, "", newHref);
}

export type LocationAndIndex = {
  readonly location: SimpleLocation;
  readonly index: number;
};

export type Transition = {
  readonly from: LocationAndIndex;
  readonly to: LocationAndIndex;
  readonly fresh: boolean;
};

export type RouterEvents = {
  readonly ready: LocationAndIndex;
  readonly "navigation-attempt": Readonly<{ confirm: () => void }>;
  readonly navigation: Transition;
  readonly "self-navigation": LocationAndIndex;
};

enum NAVIGATION_KIND {
  PUSH = 0,
  REPLACE = 1,
  POPSTATE = 2,
}

export class Router<E extends RouterEvents> extends TypedEventTarget<E> {
  private readonly mixins: readonly RouterMixin<E>[];
  private current: SimpleLocation;
  private index: number;

  constructor(mixins: (router: Router<E>) => readonly RouterMixin<E>[]) {
    super();
    this.current = createSimpleLocation({
      pathname: "",
      search: "",
      hash: "",
    });
    // https://github.com/sveltejs/kit/pull/4425#issuecomment-1076333872
    // https://github.com/sveltejs/kit/pull/4640
    this.index = Date.now();
    this.mixins = mixins(this);
  }

  private setCurrent(loc: SimpleLocation, index: Optional<number>) {
    this.current = loc;
    if (index == null) {
      this.index++;
      history.replaceState(
        { ...history.state, [INDEX_KEY]: this.index },
        "",
        location.href // Pass third argument anyway (https://bugs.webkit.org/show_bug.cgi?id=182678)
      );
      this.onFreshLoc(this.getCurrent());
    } else {
      this.index = index;
    }
  }

  getCurrent() {
    return {
      location: this.current,
      index: this.index,
    };
  }

  serverInstall(rawTarget: RawSimpleLocation) {
    this.current = createSimpleLocation(rawTarget);

    this.mixins.forEach(m => m.serverInstall());

    this.dispatchEvent(
      new TypedEvent("ready", {
        location: this.current,
        index: this.index,
      })
    );
  }

  // For No-Single-Page-App mode
  clientInstallNoSpa() {
    this.current = createSimpleLocation(location);

    this.dispatchEvent(
      new TypedEvent("ready", {
        location: this.current,
        index: this.index,
      })
    );
  }

  clientInstall(
    external: (anchor: HTMLAnchorElement) => boolean = () => false
  ) {
    // Set initial location and history entry
    this.setCurrent(createSimpleLocation(location), history.state?.[INDEX_KEY]);

    // Listen for popstate
    window.addEventListener("popstate", event => {
      this.makeNavigation(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        NAVIGATION_KIND.POPSTATE,
        event.state?.[INDEX_KEY]
      );
    });

    // Catch click events on anchors
    // Adapted from https://github.com/Polymer/pwa-helpers/blob/master/src/router.ts
    document.body.addEventListener("click", (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      ) {
        return;
      }

      const anchor = findAnchor(e);
      if (anchor) {
        if (external(anchor)) {
          if (this.hasToApproveFlag) {
            e.preventDefault();
            this.dispatchEvent(
              new TypedEvent("navigation-attempt", {
                confirm: () => {
                  window.open(anchor.href, "_self");
                },
              })
            );
          }
          return;
        }
        e.preventDefault();
        this.navigate(anchor, { replace: false });
      }
    });

    // Fix link[rel=icon], because browsers will occasionally try to load relative
    // URLs after a pushState/replaceState, resulting in a 404 — see
    // https://github.com/sveltejs/kit/issues/3748#issuecomment-1125980897
    // @ts-ignore
    for (const link of document.querySelectorAll("link")) {
      if (link.rel === "icon") {
        // Force href to be absolute
        link.href = link.href;
      }
    }

    this.mixins.forEach(m => m.clientInstall());

    this.dispatchEvent(
      new TypedEvent("ready", {
        location: this.current,
        index: this.index,
      })
    );
  }

  navigate(
    rawTarget: RawSimpleLocation,
    { replace }: { replace: boolean } = { replace: false }
  ) {
    this.makeNavigation(
      rawTarget,
      replace ? NAVIGATION_KIND.REPLACE : NAVIGATION_KIND.PUSH,
      null
    );
  }

  private hasToApproveFlag = false;

  hasToApprove() {
    return this.hasToApproveFlag;
  }

  setHasToApprove(b: boolean) {
    this.hasToApproveFlag = b;
  }

  private makeNavigation(
    rawTo: RawSimpleLocation,
    kind: NAVIGATION_KIND,
    index: Optional<number>
  ) {
    const delta = index == null ? null : index - this.index;
    const prevIndex = this.index;
    if (prevIndex === index) return;

    const prev = this.current;
    const to = createSimpleLocation(rawTo);

    if (sameSimpleLocation(prev, to)) {
      this.dispatchEvent(
        new TypedEvent("self-navigation", {
          location: prev,
          index: prevIndex,
        })
      );
      return;
    }

    if (this.hasToApproveFlag) {
      if (delta != null) {
        history.go(-delta); // Undo
      }
      this.dispatchEvent(
        new TypedEvent("navigation-attempt", {
          confirm: () => {
            if (delta == null) {
              this.navigate(rawTo, {
                replace: kind === NAVIGATION_KIND.REPLACE,
              });
            } else {
              history.go(delta);
            }
          },
        })
      );
      return;
    }

    switch (kind) {
      case NAVIGATION_KIND.PUSH:
        pushNavigation(to);
        break;
      case NAVIGATION_KIND.REPLACE:
        replaceNavigation(to);
        break;
      case NAVIGATION_KIND.POPSTATE:
        break;
      default:
        never(kind);
    }

    this.setCurrent(to, index);
    this.onTransition({
      from: {
        location: prev,
        index: prevIndex,
      },
      to: {
        location: this.current,
        index: this.index,
      },
      fresh: index == null,
    });
  }

  onFreshLoc(loc: LocationAndIndex) {
    this.mixins.forEach(m => m.onFreshLoc(loc));
  }

  onTransition(transition: Transition) {
    this.mixins.forEach(m => m.onTransition(transition));
    this.dispatchEvent(new TypedEvent("navigation", transition));
  }
}

export class RouterMixin<E extends RouterEvents> {
  protected readonly router: Router<E>;

  constructor(router: Router<E>) {
    this.router = router;
  }

  clientInstall(): void {}
  serverInstall(): void {}
  onFreshLoc(loc: LocationAndIndex): void {}
  onTransition(transition: Transition): void {}
}
