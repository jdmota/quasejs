// @flow
import { type Warning } from "../types";
import { BaseReporter } from "./base";

export class CheckReporter extends BaseReporter {

  constructor() {
    super( "Starting checks..." );
  }

  comparing( type: string ) {
    this.spinner.text = `Comparing ${type}...`;
  }

  integrity() {
    this.spinner.text = `Checking integrity...`;
  }

}

export class CheckReporterNoop extends CheckReporter {
  start() {}
  log( _: string ) {}
  error( _: Object ) {}
  warning( _: Warning ) {}
  done() {}

  comparing( _: string ) {}
  integrity() {}
}
