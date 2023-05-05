// Inspired in:
// https://dev.to/43081j/strongly-typed-event-emitters-using-eventtarget-in-typescript-3658
// https://github.com/khrj/typed-event-target/blob/main/mod.ts

export class TypedEvent<K extends string, V> extends Event {
  readonly detail: V;

  constructor(typeArg: K, detail: V) {
    super(typeArg);
    this.detail = detail;
  }
}

export type StateEventMap = { readonly [key: string]: unknown };

export class TypedEventTarget<M extends StateEventMap> extends EventTarget {
  // @ts-ignore
  override addEventListener<K extends keyof M & string>(
    type: K,
    callback: (ev: TypedEvent<K, M[K]>) => void,
    options?: AddEventListenerOptions | boolean
  ): void {
    super.addEventListener(
      type,
      callback as EventListener | EventListenerObject | null,
      options
    );
  }

  // @ts-ignore
  override removeEventListener<K extends keyof M & string>(
    type: K,
    callback: (ev: TypedEvent<K, M[K]>) => void,
    options?: EventListenerOptions | boolean
  ): void {
    super.removeEventListener(
      type,
      callback as EventListener | EventListenerObject | null,
      options
    );
  }

  override dispatchEvent<K extends keyof M & string>(
    event: TypedEvent<K, M[K]>
  ): boolean {
    return super.dispatchEvent(event);
  }

  subscribe<K extends keyof M & string>(
    type: K,
    callback: (ev: TypedEvent<K, M[K]>) => void,
    options?: AddEventListenerOptions | boolean
  ) {
    this.addEventListener(type, callback, options);
    return () => {
      this.removeEventListener(type, callback, options);
    };
  }
}
