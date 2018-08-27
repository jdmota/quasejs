// @flow
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
