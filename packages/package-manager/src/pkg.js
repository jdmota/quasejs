// @flow
import { error } from "./utils";

const readPkg = require( "read-pkg" );
const writePkg = require( "write-pkg" );
const semver = require( "semver" );

type DependenciesType = "dependencies" | "devDependencies" | "optionalDependencies";
const dependenciesTypes: DependenciesType[] = [ "dependencies", "devDependencies", "optionalDependencies" ];

export async function read( folder: string, ignoreValidation: ?boolean ): Promise<Object> {
  const x = await readPkg( { cwd: folder, normalize: true } );
  for ( const type of dependenciesTypes ) {
    if ( x[ type ] == null ) {
      x[ type ] = {};
    }
  }
  if ( !ignoreValidation ) {
    validate( x );
  }
  return x;
}

export async function write( folder: string, json: Object ) {
  return writePkg( folder, json );
}

export function validate( pkg: Object ) {

  const { name, version } = pkg;

  const dependencies = Object.keys( pkg.dependencies );

  for ( const dep of dependencies ) {
    if ( dep === name && semver.satisfies( version, pkg.dependencies[ dep ] ) ) {
      throw error( `${dep} cannot depend on himself. See dependencies` );
    }
    if ( pkg.devDependencies[ dep ] != null ) {
      throw error( `${dep} appears in both dependencies and devDependencies` );
    } else if ( pkg.optionalDependencies[ dep ] != null ) {
      throw error( `${dep} appears in both dependencies and optionalDependencies` );
    }
  }

  const devDependencies = Object.keys( pkg.devDependencies );

  for ( const dep of devDependencies ) {
    if ( dep === name && semver.satisfies( version, pkg.devDependencies[ dep ] ) ) {
      throw error( `${dep} cannot depend on himself. See devDependencies` );
    }
    if ( pkg.optionalDependencies[ dep ] != null ) {
      throw error( `${dep} appears in both devDependencies and optionalDependencies` );
    }
  }

  const optionalDependencies = Object.keys( pkg.optionalDependencies );

  for ( const dep of optionalDependencies ) {
    if ( dep === name && semver.satisfies( version, pkg.optionalDependencies[ dep ] ) ) {
      throw error( `${dep} cannot depend on himself. See optionalDependencies` );
    }
  }

}

// Adapted from pnpm/supi

function guessDependencyType( name: string, pkg: Object ): DependenciesType {
  return dependenciesTypes.find( type => pkg[ type ] && pkg[ type ][ name ] ) || "dependencies";
}

const typeMap = {
  prod: "dependencies",
  dev: "devDependencies",
  optional: "optionalDependencies"
};

export function normalizeType( type: ?( "prod" | "dev" | "optional" ) ) {
  if ( type ) {
    return typeMap[ type ];
  }
}

export function add(
  packageJson: Object,
  packageSpecs: ( {
    name: string,
    version: string
  } )[],
  saveType: ?DependenciesType
): { name: string, version: string }[] {
  const added = [];

  for ( const dependency of packageSpecs ) {

    const type = saveType || guessDependencyType( dependency.name, packageJson );

    if ( packageJson[ type ] ) {
      if ( packageJson[ type ][ dependency.name ] === dependency.version ) {
        continue;
      }
    } else {
      packageJson[ type ] = {};
    }

    packageJson[ type ][ dependency.name ] = dependency.version;
    added.push( dependency );

  }

  return added;
}

export function remove(
  packageJson: Object,
  removedPackages: string[],
  saveType: ?DependenciesType
): { name: string, version: string }[] {
  const types = saveType ? [ saveType ] : dependenciesTypes;
  const removed = [];

  for ( const deptype of types ) {
    if ( packageJson[ deptype ] ) {
      for ( const name of removedPackages ) {
        const version = packageJson[ deptype ][ name ];
        if ( version != null ) {
          delete packageJson[ deptype ][ name ];
          removed.push( {
            name,
            version
          } );
        }
      }
    }
  }

  return removed;
}
