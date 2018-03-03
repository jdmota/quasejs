// @flow

import type { Integrity, Options } from "./types";

// TODO See https://github.com/npm/npm/blob/latest/lib/config/pacote.js

export default function( opts: Options, integrity?: Integrity | void ) {
  return {
    integrity,
    cache: opts.cache,
    offline: opts.offline,
    preferOffline: opts.preferOffline,
    preferOnline: opts.preferOnline
  };
}
