import Bundle from "./bundle";
import Watcher from "./watcher";

export default function builder( options ) {
  if ( options.watch ) {
    return new Watcher( options ).start();
  }
  return new Bundle( options ).build();
}

export { Bundle, Watcher };
