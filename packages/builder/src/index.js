// @flow

import Builder from "./builder";
import Watcher from "./watcher";
import type { Options } from "./types";

export default function builder( options: Options ) {
  if ( options.watch ) {
    return new Watcher( options ).start();
  }
  return new Builder( options ).build();
}

export { Builder, Watcher };
