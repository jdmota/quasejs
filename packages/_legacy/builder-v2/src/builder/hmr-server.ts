import http from "http";
import WebSocket from "ws";
import stripAnsi from "strip-ansi";
import {
  formatDiagnostic,
  createDiagnosticFromAny,
  Diagnostic,
} from "../utils/error";
import {
  HmrUpdate,
  HmrMessage,
  HmrErrorMsg,
  HmrInfo,
  BuilderResult,
} from "../types";
import { Builder } from "./builder";
import { IncomingMessage } from "http";

export class HMRServer {
  private builder: Builder;
  private server: http.Server | null;
  private wss: WebSocket.Server | null;
  private lastErrorEvent: HmrErrorMsg | null;
  private firstBuild: boolean;
  private info: HmrInfo | null;
  private onResult: (result: BuilderResult) => void;

  constructor(builder: Builder) {
    this.builder = builder;
    this.server = null;
    this.wss = null;
    this.lastErrorEvent = null;
    this.handleSocketError = this.handleSocketError.bind(this);
    this.firstBuild = true;
    this.info = null;
    this.onResult = result => {
      if (result.state === "success") {
        this.emitUpdate(result.output.hmrUpdate);
      } else if (result.state === "error") {
        this.emitErrors(result.errors);
      }
    };
  }

  getInfo() {
    return this.info;
  }

  async start() {
    this.builder.on("build-result", this.onResult);
    this.builder.emit("hmr-starting");

    const server = (this.server = http.createServer());
    this.wss = new WebSocket.Server({
      server: this.server,
      verifyClient: (info: {
        origin: string;
        req: IncomingMessage;
        secure: boolean;
      }) => {
        if (info.origin === "file://") {
          return true;
        }
        const url = new URL(info.origin);
        return url.hostname === "localhost";
      },
    });

    await new Promise(async r => server.listen(0, "0.0.0.0", r));

    this.wss.on("connection", ws => {
      ws.onerror = this.handleSocketError;
      if (this.lastErrorEvent) {
        ws.send(JSON.stringify(this.lastErrorEvent));
      }
    });

    this.wss.on("error", this.handleSocketError);

    // If called after "listening" event, should not return null
    // And since we are using HTTP, this will not be a string
    const { port } = this.wss.address() as WebSocket.AddressInfo;
    const info = { hostname: "localhost", port };

    this.info = info;
    this.builder.emit("hmr-started", info);
  }

  async stop() {
    this.builder.off("build-result", this.onResult);

    const { wss, server } = this;
    if (wss) {
      wss.removeAllListeners();
      wss.close();
      this.wss = null;
    }
    if (server) {
      server.removeAllListeners();
      server.close();
      this.server = null;
    }
  }

  private broadcast(msg: HmrMessage) {
    if (!this.wss) throw new Error("HMR server not started");

    const json = JSON.stringify(msg);
    for (const ws of this.wss.clients) {
      ws.send(json);
    }
  }

  private emitUpdate(update: HmrUpdate) {
    if (this.firstBuild) {
      this.firstBuild = false;
      return;
    }

    this.lastErrorEvent = null;

    this.broadcast({
      type: "update",
      update,
    });
  }

  private emitErrors(errors: Diagnostic[]) {
    if (this.firstBuild) {
      this.firstBuild = false;
    }

    // Store the most recent error so we can notify new connections
    this.lastErrorEvent = {
      type: "errors",
      errors: errors.map(formatDiagnostic).map(stripAnsi),
    };

    this.broadcast(this.lastErrorEvent);
  }

  private handleSocketError(err: WebSocket.ErrorEvent) {
    if (err.error.code === "ECONNRESET") {
      // This gets triggered on page refresh
      return;
    }
    this.builder.emit("hmr-error", createDiagnosticFromAny(err.error, "warn"));
  }
}
