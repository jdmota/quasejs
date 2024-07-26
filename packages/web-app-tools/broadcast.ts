import { type BroadcastChannelType, BroadcastChannel } from "./support";

export class Broadcast<T> {
  static new<T>(name: string, Channel: BroadcastChannelType) {
    return new Broadcast<T>(name, Channel);
  }

  static maybe<T>(name: string) {
    return BroadcastChannel ? new Broadcast<T>(name, BroadcastChannel) : null;
  }

  private channel: BroadcastChannel;

  private constructor(name: string, Channel: BroadcastChannelType) {
    this.channel = new Channel(name);
  }

  send(data: T) {
    this.channel.postMessage(data);
  }

  subscribe(fn: (data: T) => void) {
    const sub = (event: MessageEvent<any>) => {
      fn(event.data);
    };
    this.channel.addEventListener("message", sub);
    return () => {
      this.channel.removeEventListener("message", sub);
    };
  }

  close() {
    this.channel.close();
  }
}
