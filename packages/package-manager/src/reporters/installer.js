// @flow
import type { Installer } from "../commands/installer";
import { BaseReporter } from "./base";

/* eslint-disable no-console */

class InstallReporter extends BaseReporter {

  jobsTotal: number;
  jobsDone: number;

  constructor() {
    super( "Starting..." );
    this.jobsTotal = 0;
    this.jobsDone = 0;
  }

  listen( installer: Installer ) {
    super.listen( installer );
    installer.on( "folder", this.folder.bind( this ) );
    installer.on( "lockfile", this.lockfile.bind( this ) );
    installer.on( "jobsStart", this.jobsStart.bind( this ) );
    installer.on( "jobDone", this.jobDone.bind( this ) );
    installer.on( "linking", this.linking.bind( this ) );
    installer.on( "updateLockfile", this.updateLockfile.bind( this ) );
  }

  folder( { folder } ) {
    console.log( `Project folder: ${folder}` );
  }

  lockfile( { reusing } ) {
    if ( reusing ) {
      console.log( `Will reuse lockfile.` );
    } else {
      console.log( `Will generate new lockfile.` );
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

}

export default function( installer: Installer ) {
  new InstallReporter().listen( installer );
}
