// @flow
import type { Warning } from "../types";
import type { Installer } from "../commands/installer";

/* eslint-disable no-console */

const ora = require( "ora" );

class InstallReporter {

  startTime: number;
  jobsTotal: number;
  jobsDone: number;
  spinner: any;

  constructor() {
    this.startTime = 0;
    this.jobsTotal = 0;
    this.jobsDone = 0;
    this.spinner = null;
  }

  listen( installer: Installer ) {
    installer.on( "start", this.start.bind( this ) );
    installer.on( "warning", this.warning.bind( this ) );
    installer.on( "folder", this.folder.bind( this ) );
    installer.on( "lockfile", this.lockfile.bind( this ) );
    installer.on( "jobsStart", this.jobsStart.bind( this ) );
    installer.on( "jobDone", this.jobDone.bind( this ) );
    installer.on( "linking", this.linking.bind( this ) );
    installer.on( "updateLockfile", this.updateLockfile.bind( this ) );
    installer.on( "done", this.done.bind( this ) );
  }

  start() {
    this.startTime = Date.now();
    this.spinner = ora( "Waiting..." ).start();
  }

  warning( warning: Warning ) {
    console.warn( `WARN: ${warning.message}` );
  }

  folder( { folder } ) {
    this.spinner.text = `Project folder: ${folder}`;
  }

  lockfile( { reusing } ) {
    if ( reusing ) {
      this.spinner.text = `Will reuse lockfile.`;
    } else {
      this.spinner.text = `Will generate new lockfile.`;
    }
  }

  jobsStart( { count } ) {
    this.jobsTotal = count;
    this.spinner.text = `Progress: 0/${this.jobsTotal}`;
  }

  jobDone() {
    this.jobsDone++;
    this.spinner.text = `Progress: ${this.jobsDone}/${this.jobsTotal}`;
  }

  linking() {
    this.spinner.text = `Linking dependencies to node_modules...`;
  }

  updateLockfile() {
    this.spinner.text = `Updating lockfile...`;
  }

  done() {
    const endTime = Date.now();
    this.spinner.text = `Done in ${endTime - this.startTime} ms.`;
  }

}

export default function( installer: Installer ) {
  new InstallReporter().listen( installer );
}
