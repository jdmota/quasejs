// Adapted from https://github.com/sindresorhus/np

const semver = require( "semver" );

export const SEMVER_INCREMENTS = [ "patch", "minor", "major", "prepatch", "preminor", "premajor", "prerelease" ];
export const PRERELEASE_VERSIONS = [ "prepatch", "preminor", "premajor", "prerelease" ];

const isValidVersion = input => Boolean( semver.valid( input ) );

export const isValidVersionInput = input => SEMVER_INCREMENTS.indexOf( input ) !== -1 || isValidVersion( input );

export const isPrereleaseVersion = version => PRERELEASE_VERSIONS.indexOf( version ) !== -1 || Boolean( semver.prerelease( version ) );

export const getNewVersion = ( oldVersion, input ) => {
  if ( !isValidVersionInput( input ) ) {
    throw new Error( `Version should be either ${SEMVER_INCREMENTS.join( ", " )} or a valid semver version.` );
  }

  return SEMVER_INCREMENTS.indexOf( input ) === -1 ? input : semver.inc( oldVersion, input );
};

export const isVersionGreater = ( oldVersion, newVersion ) => {
  if ( !isValidVersion( newVersion ) ) {
    throw new Error( "Version should be a valid semver version." );
  }

  return semver.gt( newVersion, oldVersion );
};

export const isVersionLower = ( oldVersion, newVersion ) => {
  if ( !isValidVersion( newVersion ) ) {
    throw new Error( "Version should be a valid semver version." );
  }

  return semver.lt( newVersion, oldVersion );
};

export const satisfies = ( version, range ) => semver.satisfies( version, range );
