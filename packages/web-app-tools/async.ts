export type AsyncResult<P, R> =
  | {
      readonly props: P;
      readonly data: R;
      readonly error: null;
      readonly isPending: false;
      readonly cancel: null;
      readonly previous: null;
    }
  | {
      readonly props: P;
      readonly data: null;
      readonly error: Error;
      readonly isPending: false;
      readonly cancel: null;
      readonly previous: null;
    }
  | {
      readonly props: P;
      readonly data: R | null;
      readonly error: null;
      readonly isPending: true;
      readonly cancel: (err: Error | null) => void;
      readonly previous: AsyncResult<P, R> | null;
    };

type FetchFn<P, R> = (props: P, controller: AbortController) => Promise<R>;

type OptimisticFn<P, R> = (props: P) => R | null;

type AsyncOpts<P, R> = Readonly<{
  initial: Readonly<{
    props: P;
    data: R;
  }> | null;
  fetch: FetchFn<P, R>;
  optimistic: OptimisticFn<P, R> | null;
}>;

export class Async<P, R> {
  private fetch: FetchFn<P, R>;
  private optimistic: OptimisticFn<P, R> | null;
  private result: AsyncResult<P, R> | null;

  constructor({ initial, fetch, optimistic }: AsyncOpts<P, R>) {
    this.fetch = fetch;
    this.optimistic = optimistic;
    this.result = initial
      ? {
          props: initial.props,
          data: initial.data,
          error: null,
          isPending: false,
          cancel: null,
          previous: null,
        }
      : null;
  }

  private setResult(result: AsyncResult<P, R>) {
    this.result = result;
    // TODO notify
  }

  private startRequest(props: P) {
    const controller = new AbortController();
    let cancelled = false;
    this.fetch(props, controller).then(
      data =>
        cancelled ||
        this.setResult({
          props,
          data,
          error: null,
          isPending: false,
          cancel: null,
          previous: null,
        }),
      error =>
        cancelled ||
        this.setResult({
          props,
          data: null,
          error,
          isPending: false,
          cancel: null,
          previous: null,
        })
    );
    return (error: Error | null) => {
      if (!cancelled) {
        cancelled = true;
        controller.abort();
        if (error) {
          this.setResult({
            props,
            data: null,
            error,
            isPending: false,
            cancel: null,
            previous: null,
          });
        }
      }
    };
  }

  cancel(error: Error) {
    if (this.result != null && this.result.isPending) {
      this.result.cancel(error);
    }
  }

  reload(props: P) {
    if (this.result != null && this.result.isPending) {
      // Cancel previous request without an error so that we do not call setResult twice
      this.result.cancel(null);
    }
    this.setResult({
      props,
      data: this.optimistic ? this.optimistic(props) : null,
      error: null,
      isPending: true,
      cancel: this.startRequest(props),
      previous:
        this.result == null
          ? null
          : this.result.isPending
          ? this.result.previous
          : this.result,
    });
  }

  setProps(props: P) {
    if (this.result == null || this.result.props !== props) {
      this.reload(props);
    }
  }
}
