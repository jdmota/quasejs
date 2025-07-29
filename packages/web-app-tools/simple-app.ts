import { type RouterEvents, Router } from "./router/router.ts";
import {
  type ScrollData,
  type ScrollEvents,
  ScrollMixin,
  scroll as performScroll,
} from "./router/router.scroll.ts";
import {
  type NormalizedPathname,
  type SimpleLocation,
  type SimpleLocationNoHash,
  sameSimpleLocationExceptHash,
} from "./router/pathname.ts";
import { Subscribable } from "./subscribable.ts";
import type { AsyncResult } from "./async.ts";
import { goTop } from "./ui.ts";
import { type InitialDataForHydration } from "./router/router.data.ts";

export class SimpleApp extends Subscribable<SimpleLocation> {
  readonly router: Router<RouterEvents & ScrollEvents>;
  private readonly pendingScrolls: Map<NormalizedPathname, ScrollData>;

  constructor() {
    super();
    this.router = new Router<RouterEvents & ScrollEvents>(router => [
      new ScrollMixin(router, { getKey: ({ location }) => location.pathname }),
    ]);
    this.pendingScrolls = new Map();
  }

  init(server: boolean) {
    this.router.addEventListener("ready", ({ detail: { location } }) => {
      this.pendingScrolls.set(location.pathname, {
        pos: null,
        hash: location.hash,
      });
    });

    this.router.addEventListener(
      "navigationWithScroll",
      ({
        detail: {
          transition: { to, from, fresh },
          scroll,
        },
      }) => {
        this.emit(to.location);

        if (sameSimpleLocationExceptHash(from.location, to.location)) {
          // If only the hash has changed, jump immediately
          performScroll({ pos: null, hash: to.location.hash });
        } else {
          this.pendingScrolls.set(to.location.pathname, {
            pos: fresh ? null : scroll,
            hash: to.location.hash,
          });
        }
      }
    );

    this.router.addEventListener(
      "self-navigation",
      ({ detail: { location } }) => {
        performScroll({ pos: null, hash: location.hash });
      }
    );

    if (server) {
      this.router.serverInstall({ pathname: "/" });
    } else {
      this.router.clientInstall();
    }
    this.emit(this.router.getCurrent().location);
    return this;
  }

  applyScroll() {
    const pending = this.pendingScrolls.get(
      this.router.getCurrent().location.pathname
    );
    this.pendingScrolls.clear();
    if (pending) {
      performScroll(pending);
    } else {
      goTop();
    }
  }
}

export function getDefaultAsyncResult<T>(
  initialData: InitialDataForHydration<T> | null
): AsyncResult<SimpleLocationNoHash, T> {
  return initialData
    ? {
        props: initialData.props,
        data: initialData.data,
        error: null,
        isPending: false,
        cancel: null,
        previous: null,
      }
    : {
        props: {
          pathname: "/",
          search: "",
        } as SimpleLocationNoHash,
        data: null,
        error: null,
        isPending: true,
        cancel: () => {},
        previous: null,
      };
}

/*
const defaultResult = getDefaultAsyncResult(initialData);
let loc: Loc = $state(defaultResult.props);
let result: AsyncResult<Loc, DATA> = $state(defaultResult);
let toRender = $derived(
  result.isPending ? (result.previous ?? result) : result
);

const asyncRoot = new Async<Loc, DATA>({
  initial: initialData,
  fetch: fetchData,
  optimistic: null,
  equalProps: sameSimpleLocationNoHash,
});

app.subscribe(l => {
  if (import.meta.env.DEV) {
    console.log("Navigation", l);
  }
  loc = l;
  asyncRoot.setProps(loc);
});

asyncRoot.subscribe(r => {
  result = r;
  onResult(r);
});

app.init(import.meta.env.SSR);
*/
