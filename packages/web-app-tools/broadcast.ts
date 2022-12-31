import type { BroadcastChannelType } from "./support";
import { BroadcastChannel } from "./support";

export class Broadcast<T> {
  static new<T>(name: string, Channel: BroadcastChannelType) {
    return new Broadcast<T>(name, Channel);
  }

  static maybe<T>(name: string) {
    return BroadcastChannel ? new Broadcast<T>(name, BroadcastChannel) : null;
  }

  private cannel: BroadcastChannel;

  private constructor(name: string, Channel: BroadcastChannelType) {
    this.cannel = new Channel(name);
  }

  send(data: T) {
    this.cannel.postMessage(data);
  }

  subscribe(fn: (data: T) => void) {
    const sub = (event: MessageEvent<any>) => {
      fn(event.data);
    };
    this.cannel.addEventListener("message", sub);
    return () => {
      this.cannel.removeEventListener("message", sub);
    };
  }

  close() {
    this.cannel.close();
  }
}
