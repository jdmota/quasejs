// @flow
import type { Warning } from "../types";
import type { Checker } from "../commands/check";

/* eslint-disable no-console */

const ora = require( "ora" );

class CheckReporter {

  startTime: number;
  spinner: any;

  constructor() {
    this.startTime = 0;
    this.spinner = null;
  }

  listen( checker: Checker ) {
    checker.on( "start", this.start.bind( this ) );
    checker.on( "warning", this.warning.bind( this ) );
    checker.on( "comparing", this.comparing.bind( this ) );
    checker.on( "integrity", this.warning.bind( this ) );
    checker.on( "done", this.done.bind( this ) );
  }

  start() {
    this.startTime = Date.now();
    this.spinner = ora( "Looking for lockfile..." ).start();
  }

  warning( warning: Warning ) {
    console.warn( `WARN: ${warning.message}` );
  }

  comparing( type: string ) {
    this.spinner.text = `Comparing ${type}...`;
  }

  integrity() {
    this.spinner.text = `Checking integrity...`;
  }

  done() {
    const endTime = Date.now();
    this.spinner.text = `Done in ${endTime - this.startTime} ms.`;
  }

}

export default function( checker: Checker ) {
  new CheckReporter().listen( checker );
}
