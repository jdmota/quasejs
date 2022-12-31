enum Action {
  Pop = "POP",
  Push = "PUSH",
  Replace = "REPLACE",
}

type Pathname = string;
type Search = string;
type Hash = string;
type Key = string;

interface Path {
  pathname: Pathname;
  search: Search;
  hash: Hash;
}

interface Location extends Path {
  state: unknown;
  key: Key;
}

interface Update {
  action: Action;
  location: Location;
}

interface Listener {
  (update: Update): void;
}

interface Transition extends Update {
  retry(): void;
}

interface Blocker {
  (tx: Transition): void;
}

type To = string | Partial<Path>;

export interface History {
  /**
   * The last action that modified the current location. This will always be
   * Action.Pop when a history instance is first created. This value is mutable.
   *
   * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.action
   */
  readonly action: Action;
  readonly location: Location;
  push(to: To, state?: any): void;
  replace(to: To, state?: any): void;
  go(delta: number): void;
  back(): void;
  forward(): void;
  listen(listener: Listener): () => void;

  /**
   * Prevents the current location from changing and sets up a listener that
   * will be called instead.
   *
   * @param blocker - A function that will be called when a transition is blocked
   * @returns unblock - A function that may be used to stop blocking
   *
   * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#history.block
   */
  block(blocker: Blocker): () => void;
}

interface BrowserHistory extends History {}

const readOnly: <T>(obj: T) => Readonly<T> = obj => Object.freeze(obj);

function warning(cond: any, message: string) {
  if (!cond) {
    // eslint-disable-next-line no-console
    if (typeof console !== "undefined") console.warn(message);

    try {
      // Welcome to debugging history!
      //
      // This error is thrown as a convenience so you can more easily
      // find the source for a warning that appears in the console by
      // enabling "pause on exceptions" in your JavaScript debugger.
      throw new Error(message);
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }
}

type HistoryState = {
  usr?: any;
  key?: string;
  idx?: number;
};

const BeforeUnloadEventType = "beforeunload";
const PopStateEventType = "popstate";
export function createBrowserHistory(): BrowserHistory {
  const globalHistory = window.history;

  function getIndexAndLocation(): [number, Location] {
    const { pathname, search, hash } = window.location;
    const state = globalHistory.state || {};
    return [
      state.idx,
      readOnly<Location>({
        pathname,
        search,
        hash,
        state: state.usr || null,
        key: state.key || "default",
      }),
    ];
  }

  let blockedPopTx: Transition | null = null;
  function handlePop() {
    if (blockedPopTx) {
      // TODO we might have issues here if we back() twice, since popstate run async
      blockers.call(blockedPopTx);
      blockedPopTx = null;
    } else {
      const nextAction = Action.Pop;
      const [nextIndex, nextLocation] = getIndexAndLocation();

      if (blockers.length) {
        if (nextIndex != null) {
          const delta = index - nextIndex;
          if (delta) {
            // Revert the POP
            blockedPopTx = {
              action: nextAction,
              location: nextLocation,
              retry() {
                go(delta * -1);
              },
            };

            go(delta);
          }
        } else {
          // Trying to POP to a location with no index. We did not create
          // this location, so we can't effectively block the navigation.
          warning(
            false,
            // TODO: Write up a doc that explains our blocking strategy in
            // detail and link to it here so people can understand better what
            // is going on and how to avoid it.
            `You are trying to block a POP navigation to a location that was not ` +
              `created by the history library. The block will fail silently in ` +
              `production, but in general you should do all navigation with the ` +
              `history library (instead of using window.history.pushState directly) ` +
              `to avoid this situation.`
          );
        }
      } else {
        applyTx(nextAction);
      }
    }
  }

  window.addEventListener(PopStateEventType, handlePop);

  let action = Action.Pop;
  let [index, location] = getIndexAndLocation();
  const listeners = createEvents<Listener>();
  const blockers = createEvents<Blocker>();

  if (index == null) {
    index = Date.now();
    globalHistory.replaceState({ ...globalHistory.state, idx: index }, "");
  }

  function getHistoryStateAndUrl(
    nextLocation: Location,
    index: number
  ): [HistoryState, string] {
    return [
      {
        usr: nextLocation.state,
        key: nextLocation.key,
        idx: index,
      },
      createPath(nextLocation),
    ];
  }

  function allowTx(action: Action, location: Location, retry: () => void) {
    return (
      !blockers.length || (blockers.call({ action, location, retry }), false)
    );
  }

  function applyTx(nextAction: Action) {
    action = nextAction;
    [index, location] = getIndexAndLocation();
    listeners.call({ action, location });
  }

  function pushOrReplace(replace: boolean, to: Path, state: any) {
    const nextAction = replace ? Action.Replace : Action.Push;
    const nextLocation = readOnly<Location>({
      ...to,
      state,
      key: Math.random().toString(36).substring(2, 10),
    });

    function retry() {
      pushOrReplace(replace, to, state);
    }

    if (allowTx(nextAction, nextLocation, retry)) {
      const [historyState, url] = getHistoryStateAndUrl(
        nextLocation,
        replace ? index : index + 1
      );

      // iOS limits us to 100 pushState calls :/
      try {
        globalHistory[replace ? "replaceState" : "pushState"](
          historyState,
          "",
          url
        );
      } catch (error) {
        // TODO https://codepen.io/morten-olsen/post/when-safari-broke-webapps
        window.location.assign(url);
      }

      applyTx(nextAction);
    }
  }

  function go(delta: number) {
    globalHistory.go(delta);
  }

  const history: BrowserHistory = {
    get action() {
      return action;
    },
    get location() {
      return location;
    },
    push(to: Path, state: any = null) {
      pushOrReplace(false, to, state);
    },
    replace(to: Path, state: any = null) {
      pushOrReplace(true, to, state);
    },
    go,
    back() {
      go(-1);
    },
    forward() {
      go(1);
    },
    listen(listener) {
      return listeners.push(listener);
    },
    block(blocker) {
      const unblock = blockers.push(blocker);

      if (blockers.length === 1) {
        window.addEventListener(BeforeUnloadEventType, promptBeforeUnload);
      }

      return function () {
        unblock();

        // Remove the beforeunload listener so the document may
        // still be salvageable in the pagehide event.
        // See https://html.spec.whatwg.org/#unloading-documents
        if (!blockers.length) {
          window.removeEventListener(BeforeUnloadEventType, promptBeforeUnload);
        }
      };
    },
  };

  return history;
}

function promptBeforeUnload(event: BeforeUnloadEvent) {
  // Cancel the event.
  event.preventDefault();
  // Chrome (and legacy IE) requires returnValue to be set.
  event.returnValue = "";
}

type Events<F> = {
  length: number;
  push: (fn: F) => () => void;
  call: (arg: any) => void;
};

function createEvents<F extends Function>(): Events<F> {
  let handlers: F[] = [];

  return {
    get length() {
      return handlers.length;
    },
    push(fn: F) {
      handlers.push(fn);
      return function () {
        handlers = handlers.filter(handler => handler !== fn);
      };
    },
    call(arg) {
      handlers.forEach(fn => fn && fn(arg));
    },
  };
}

function createPath({ pathname = "/", search = "", hash = "" }: Partial<Path>) {
  if (search && search !== "?")
    pathname += search.charAt(0) === "?" ? search : "?" + search;
  if (hash && hash !== "#")
    pathname += hash.charAt(0) === "#" ? hash : "#" + hash;
  return pathname;
}
