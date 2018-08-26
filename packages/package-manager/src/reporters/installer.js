// @flow
import type { Installer } from "../commands/installer";
import { BaseReporter } from "./base";

/* eslint-disable no-console */

class InstallReporter extends BaseReporter {

  jobsTotal: number;
  jobsDone: number;
  phase: string;

  constructor() {
    super( "Installing..." );
    this.jobsTotal = 0;
    this.jobsDone = 0;
    this.phase = "";
  }

  listen( installer: Installer ) {
    super.listen( installer );
    installer.on( "folder", this.folder.bind( this ) );
    installer.on( "lockfile", this.lockfile.bind( this ) );
    installer.on( "resolutionStart", this.jobStart.bind( this, "Resolution" ) );
    installer.on( "resolutionMore", this.jobMore.bind( this ) );
    installer.on( "resolutionUpdate", this.jobUpdate.bind( this ) );
    installer.on( "extractionStart", this.jobStart.bind( this, "Extraction" ) );
    installer.on( "extractionMore", this.jobMore.bind( this ) );
    installer.on( "extractionUpdate", this.jobUpdate.bind( this ) );
    installer.on( "linkingStart", this.jobStart.bind( this, "Linking" ) );
    installer.on( "linkingMore", this.jobMore.bind( this ) );
    installer.on( "linkingUpdate", this.jobUpdate.bind( this ) );
    installer.on( "localLinkingStart", this.jobStart.bind( this, "Local linking" ) );
    installer.on( "localLinkingMore", this.jobMore.bind( this ) );
    installer.on( "localLinkingUpdate", this.jobUpdate.bind( this ) );
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

export default function( installer: Installer ) {
  new InstallReporter().listen( installer );
}
