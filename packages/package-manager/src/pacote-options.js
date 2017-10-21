// @flow

import type { Integrity } from "./types";
import type { InstallOptions } from "./installer";

// TODO See https://github.com/npm/npm/blob/latest/lib/config/pacote.js

export default function( opts: InstallOptions, integrity?: Integrity | void ) {
  return {
    integrity,
    cache: opts.cache,
    offline: opts.offline,
    preferOffline: opts.preferOffline,
    preferOnline: opts.preferOnline
  };
}
