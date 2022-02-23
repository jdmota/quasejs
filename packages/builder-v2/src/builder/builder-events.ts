import { EventEmitter } from "events";
import {
  FileUpdates,
  HmrInfo,
  BuilderResult,
  BuilderSetupResult,
  BuilderTeardownResult,
} from "../types";
import { Diagnostic } from "../utils/error";

export class BuilderEvents extends EventEmitter {
  on(event: "status", listener: (status: string) => void): this;
  on(
    event: "build-setup",
    listener: (result: BuilderSetupResult) => void
  ): this;
  on(event: "build-result", listener: (result: BuilderResult) => void): this;
  on(
    event: "build-teardown",
    listener: (result: BuilderTeardownResult) => void
  ): this;
  on(event: "watching", listener: (files: string[]) => void): this;
  on(event: "files-updated", listener: (updates: FileUpdates) => void): this;
  on(event: "warning", listener: (warning: Diagnostic) => void): this;
  on(event: "hmr-starting", listener: () => void): this;
  on(event: "hmr-started", listener: (info: HmrInfo) => void): this;
  on(event: "hmr-error", listener: (error: Diagnostic) => void): this;
  on(event: "sigint", listener: () => void): this;
  on(event: string, listener: any) {
    return super.on(event, listener);
  }

  emit(event: "status", status: string): boolean;
  emit(event: "build-setup", result: BuilderSetupResult): boolean;
  emit(event: "build-result", result: BuilderResult): boolean;
  emit(event: "build-teardown", result: BuilderTeardownResult): boolean;
  emit(event: "watching", files: string[]): boolean;
  emit(event: "files-updated", updates: FileUpdates): boolean;
  emit(event: "warning", warning: Diagnostic): boolean;
  emit(event: "hmr-starting"): boolean;
  emit(event: "hmr-started", info: HmrInfo): boolean;
  emit(event: "hmr-error", error: Diagnostic): boolean;
  emit(event: "sigint"): boolean;
  emit(event: string, value?: any) {
    return super.emit(event, value);
  }
}
