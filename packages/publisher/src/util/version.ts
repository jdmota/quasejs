// Adapted from https://github.com/sindresorhus/np

const semver = require( "semver" );

export const SEMVER_INCREMENTS = [ "patch", "minor", "major", "prepatch", "preminor", "premajor", "prerelease" ];
export const PRERELEASE_VERSIONS = [ "prepatch", "preminor", "premajor", "prerelease" ];

export const isValidVersion = ( input: string ) => Boolean( semver.valid( input ) );

export const isValidInput = ( input: string ) => SEMVER_INCREMENTS.includes( input ) || isValidVersion( input );

export const validate = ( version: string ) => {
  if ( !isValidVersion( version ) ) {
    throw new Error( "Version should be a valid semver version." );
  }
};

export const isValidVersionInput = ( input: string ) => SEMVER_INCREMENTS.includes( input ) || isValidVersion( input );

export const isPrereleaseVersion = ( version: string ) => PRERELEASE_VERSIONS.includes( version ) || Boolean( semver.prerelease( version ) );

export const getNewVersion = ( oldVersion: string, input: string ): string => {
  validate( oldVersion );
  if ( !isValidVersionInput( input ) ) {
    throw new Error( `Version should be either ${SEMVER_INCREMENTS.join( ", " )} or a valid semver version.` );
  }
  return SEMVER_INCREMENTS.includes( input ) ? semver.inc( oldVersion, input ) : input;
};

export const isVersionGreater = ( oldVersion: string, newVersion: string ): boolean => {
  if ( !isValidVersion( newVersion ) ) {
    throw new Error( "Version should be a valid semver version." );
  }

  return semver.gt( newVersion, oldVersion );
};

export const isVersionLower = ( oldVersion: string, newVersion: string ): boolean => {
  if ( !isValidVersion( newVersion ) ) {
    throw new Error( "Version should be a valid semver version." );
  }

  return semver.lt( newVersion, oldVersion );
};

export const isGreaterThanOrEqualTo = ( otherVersion: string, version: string ): boolean => {
  validate( version );
  validate( otherVersion );

  return semver.gte( otherVersion, version );
};

export const isLowerThanOrEqualTo = ( otherVersion: string, version: string ): boolean => {
  validate( version );
  validate( otherVersion );

  return semver.lte( otherVersion, version );
};

export const isLowerThan = ( otherVersion: string, version: string ): boolean => {
  validate( version );
  validate( otherVersion );

  return semver.lt( otherVersion, version );
};

export const satisfies = ( version: string, range: string ): boolean => semver.satisfies( version, range );
