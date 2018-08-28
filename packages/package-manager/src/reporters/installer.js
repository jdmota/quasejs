// @flow
import { type Warning } from "../types";
import { BaseReporter } from "./base";

/* eslint-disable no-console */

const logSymbols = require( "log-symbols" );

export class InstallReporter extends BaseReporter {

  jobsTotal: number;
  jobsDone: number;
  phase: string;

  constructor() {
    super( "Installing..." );
    this.jobsTotal = 0;
    this.jobsDone = 0;
    this.phase = "";
  }

  resolutionStart( count: ?number ) {
    this.jobStart( "Resolution", count );
  }

  resolutionMore( count: ?number ) {
    this.jobMore( count );
  }

  resolutionUpdate() {
    this.jobUpdate();
  }

  extractionStart( count: ?number ) {
    this.jobStart( "Extraction", count );
  }

  extractionMore( count: ?number ) {
    this.jobMore( count );
  }

  extractionUpdate() {
    this.jobUpdate();
  }

  linkingStart( count: ?number ) {
    this.jobStart( "Linking", count );
  }

  linkingMore( count: ?number ) {
    this.jobMore( count );
  }

  linkingUpdate() {
    this.jobUpdate();
  }

  localLinkingStart( count: ?number ) {
    this.jobStart( "Local linking", count );
  }

  localLinkingMore( count: ?number ) {
    this.jobMore( count );
  }

  localLinkingUpdate() {
    this.jobUpdate();
  }

  folder( { folder }: { folder: string } ) {
    console.log( `${logSymbols.info} Project folder: ${folder}` );
  }

  lockfile( { reusing }: { reusing: boolean } ) {
    if ( reusing ) {
      console.log( `${logSymbols.info} Will reuse lockfile.` );
    } else {
      console.log( `${logSymbols.info} Will generate new lockfile.` );
    }
  }

  jobStart( phase: string, count: ?number ) {
    this.jobsTotal = count == null ? 0 : count;
    this.jobsDone = 0;
    this.phase = phase;
    this.spinner.text = `${phase} - Progress: 0/${this.jobsTotal}`;
  }

  jobMore( count: ?number ) {
    this.jobsTotal += count == null ? 1 : count;
    this.spinner.text = `${this.phase} - Progress: ${this.jobsDone}/${this.jobsTotal}`;
  }

  jobUpdate() {
    this.jobsDone++;
    this.spinner.text = `${this.phase} - Progress: ${this.jobsDone}/${this.jobsTotal}`;
  }

  updateLockfile() {
    this.spinner.text = `Updating lockfile...`;
  }

}

export class InstallReporterNoop extends InstallReporter {
  start() {}
  log( _: string ) {}
  error( _: Object ) {}
  warning( _: Warning ) {}
  done() {}

  resolutionStart( _: ?number ) {}
  resolutionMore( _: ?number ) {}
  resolutionUpdate() {}
  extractionStart( _: ?number ) {}
  extractionMore( _: ?number ) { }
  extractionUpdate() {}
  linkingStart( _: ?number ) {}
  linkingMore( _: ?number ) {}
  linkingUpdate() {}
  localLinkingStart( _: ?number ) {}
  localLinkingMore( _: ?number ) {}
  localLinkingUpdate() {}
  folder( _: { folder: string } ) {}
  lockfile( _: { reusing: boolean } ) {}
  jobStart( _: string, __: ?number ) {}
  jobMore( _: ?number ) {}
  jobUpdate() {}
  updateLockfile() {}
}
