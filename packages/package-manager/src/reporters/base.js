// @flow
import type { Warning } from "../types";

/* eslint-disable no-console */

const ora = require( "ora" );

export class BaseReporter {

  +initialMsg: string;
  startTime: number;
  spinner: any;

  constructor( initialMsg: string ) {
    this.initialMsg = initialMsg;
    this.startTime = 0;
    this.spinner = null;
  }

  listen( emitter: Object ) {
    emitter.on( "start", this.start.bind( this ) );
    emitter.on( "error", this.error.bind( this ) );
    emitter.on( "warning", this.warning.bind( this ) );
    emitter.on( "done", this.done.bind( this ) );
  }

  start() {
    this.startTime = Date.now();
    this.spinner = ora( this.initialMsg ).start();
  }

  error( error: Error ) {
    this.spinner.fail( error.message );
    process.exitCode = 1;
  }

  warning( warning: Warning ) {
    console.warn( `WARN: ${warning.message}` );
  }

  done() {
    const endTime = Date.now();
    this.spinner.succeed( `Done in ${endTime - this.startTime} ms.` );
  }

}
