// @flow
import type { Checker } from "../commands/check";
import { BaseReporter } from "./base";

class CheckReporter extends BaseReporter {

  constructor() {
    super( "Looking for lockfile..." );
  }

  listen( checker: Checker ) {
    super.listen( checker );
    checker.on( "comparing", this.comparing.bind( this ) );
    checker.on( "integrity", this.warning.bind( this ) );
  }

  comparing( type: string ) {
    this.spinner.text = `Comparing ${type}...`;
  }

  integrity() {
    this.spinner.text = `Checking integrity...`;
  }

}

export default function( checker: Checker ) {
  new CheckReporter().listen( checker );
}
