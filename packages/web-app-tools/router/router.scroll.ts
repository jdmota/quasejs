import { never, type ObjRecord } from "../utils";
import { sessionGet, sessionSet } from "../session-storage";
import lifecycle from "./lifecycle/export";
import { type NormalizedHash } from "./pathname";
import {
  Transition,
  LocationAndIndex,
  RouterEvents,
  RouterMixin,
  Router,
} from "./router";
import { TypedEvent } from "../events";

const SCROLL_KEY = "quase_router_scroll";

export type ScrollPosition = Readonly<{ x: number; y: number }>;

export function getScrollState(): ScrollPosition {
  return {
    x: window.scrollX,
    y: window.scrollY,
  };
}

export function scroll(position: ScrollPosition | null, hash: NormalizedHash) {
  if (position) {
    scrollTo(position.x, position.y);
  } else {
    const element = document.getElementById(hash);
    if (element) {
      element.scrollIntoView();
    } else {
      scrollTo(0, 0);
    }
  }
}

export type ScrollEvents = {
  readonly navigationWithScroll: {
    readonly transition: Transition;
    readonly scroll: ScrollPosition | null;
  };
};

export type ScrollOpts = {
  readonly getKey: (loc: LocationAndIndex) => string;
};

export class ScrollMixin<
  E extends ScrollEvents & RouterEvents
> extends RouterMixin<E> {
  private readonly opts: ScrollOpts;
  private scrollPositions: ObjRecord<string, ScrollPosition>;

  constructor(router: Router<E>, opts: ScrollOpts) {
    super(router);
    this.opts = opts;
    this.scrollPositions = {};
  }

  private getScrollPos(loc: LocationAndIndex) {
    return this.scrollPositions[this.opts.getKey(loc)] ?? null;
  }

  private saveScrollPos(loc: LocationAndIndex) {
    this.scrollPositions[this.opts.getKey(loc)] = getScrollState();
  }

  override clientInstall(): void {
    // Get currently stored scroll positions
    this.scrollPositions = sessionGet(SCROLL_KEY) || {};

    // Setup scrollRestoration to "manual" on load and "auto" on exit
    history.scrollRestoration = "manual";
    lifecycle.addEventListener("statechange", event => {
      switch (event.newState) {
        case "hidden":
          this.saveScrollPos(this.router.getCurrent());
          sessionSet(SCROLL_KEY, this.scrollPositions);
          history.scrollRestoration = "auto";
        case "frozen":
        case "terminated":
          break;
        case "active":
        case "passive":
          history.scrollRestoration = "manual";
          break;
        default:
          never(event.newState);
      }
    });
  }

  override onFreshLoc(loc: LocationAndIndex) {
    // If we navigated back, then pushed a new state, we can release memory
    //for (let i = loc.index + 1; this.scrollPositions[i]; i++) {
    //this.scrollPositions[i] = undefined; // FIXME
    //}
  }

  override onTransition(opts: Transition) {
    this.saveScrollPos(opts.from);
    this.onScroll(opts, this.getScrollPos(opts.to));
  }

  onScroll(transition: Transition, scroll: ScrollPosition | null) {
    this.router.dispatchEvent(
      new TypedEvent("navigationWithScroll", {
        transition,
        scroll,
      })
    );
  }
}
