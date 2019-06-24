// @flow
import type { Warning } from "../types";

/* eslint-disable no-console */

const ora = require( "ora" );
const logSymbols = require( "log-symbols" );

export class BaseReporter {

  +initialMsg: string;
  startTime: number;
  spinner: any;

  constructor( initialMsg: string ) {
    this.initialMsg = initialMsg;
    this.startTime = 0;
    this.spinner = null;
  }

  start() {
    this.startTime = Date.now();
    this.spinner = ora( this.initialMsg ).start();
  }

  log( text: string ) {
    if ( this.spinner ) {
      this.spinner.stop();
    }
    console.log( `\n${logSymbols.info} ${text}\n` );
    if ( this.spinner ) {
      this.spinner.start();
    }
  }

  error( error: Object ) {
    if ( !this.spinner ) {
      this.spinner = ora( this.initialMsg );
    }
    this.spinner.fail( error.__fromManager ? error.message : error.stack );
    process.exitCode = 1;
  }

  warning( warning: Warning ) {
    if ( this.spinner ) {
      this.spinner.stop();
    }
    console.warn( `\n${logSymbols.warning} ${warning.message}\n` );
    if ( this.spinner ) {
      this.spinner.start();
    }
  }

  done() {
    const endTime = Date.now();
    this.spinner.succeed( `Done in ${endTime - this.startTime} ms.` );
  }

}
