import { Broadcast } from "./broadcast";
import { Subscribable } from "./subscribable";

export abstract class AbstractDatabase<Event> extends Subscribable<Event> {
  private readonly broadcast: Broadcast<Event> | null;
  private readonly unsub: (() => void) | undefined;

  constructor(namespace: string) {
    super();
    this.broadcast = Broadcast.maybe(namespace);
    this.unsub = this.broadcast?.subscribe(data =>
      this.dataChange(data, false)
    );
  }

  abstract reload(): Promise<void>;

  protected dataChange(data: Event, broadcast: boolean) {
    if (broadcast) {
      this.broadcast?.send(data);
    }
    this.emit(data);
  }

  override close() {
    super.close();
    this.unsub?.();
    this.broadcast?.close();
  }
}
