// @flow

const readPkg = require( "read-pkg" );
const writePkg = require( "write-pkg" );
const semver = require( "semver" );

type DependenciesType = "dependencies" | "devDependencies" | "optionalDependencies";
const dependenciesTypes: DependenciesType[] = [ "dependencies", "devDependencies", "optionalDependencies" ];

export async function read( folder: string ): Promise<Object> {
  const x = await readPkg( { cwd: folder, normalize: true } );
  for ( const type of dependenciesTypes ) {
    if ( x[ type ] == null ) {
      x[ type ] = {};
    }
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
      throw new Error( `${dep} cannot depend on himself. See dependencies` );
    }
    if ( pkg.devDependencies[ dep ] != null ) {
      throw new Error( `${dep} appears in both dependencies and devDependencies` );
    } else if ( pkg.optionalDependencies[ dep ] != null ) {
      throw new Error( `${dep} appears in both dependencies and optionalDependencies` );
    }
  }

  const devDependencies = Object.keys( pkg.devDependencies );

  for ( const dep of devDependencies ) {
    if ( dep === name && semver.satisfies( version, pkg.devDependencies[ dep ] ) ) {
      throw new Error( `${dep} cannot depend on himself. See devDependencies` );
    }
    if ( pkg.optionalDependencies[ dep ] != null ) {
      throw new Error( `${dep} appears in both devDependencies and optionalDependencies` );
    }
  }

  const optionalDependencies = Object.keys( pkg.optionalDependencies );

  for ( const dep of optionalDependencies ) {
    if ( dep === name && semver.satisfies( version, pkg.optionalDependencies[ dep ] ) ) {
      throw new Error( `${dep} cannot depend on himself. See optionalDependencies` );
    }
  }

}

// Adapted from pnpm/supi

function guessDependencyType( name: string, pkg: Object ): DependenciesType {
  return dependenciesTypes.find( type => Boolean( pkg[ type ] && pkg[ type ][ name ] ) ) || "dependencies";
}

export function add(
  packageJson: Object,
  packageSpecs: ( {
    name: string,
    spec: string
  } )[],
  saveType: ?DependenciesType
): { packageJson: Object, mutated: boolean } {
  let mutated = false;

  packageSpecs.forEach( dependency => {

    const type = saveType || guessDependencyType( dependency.name, packageJson );

    if ( packageJson[ type ] ) {
      if ( packageJson[ type ][ dependency.name ] === dependency.spec ) {
        return;
      }
    } else {
      packageJson[ type ] = {};
    }
    packageJson[ type ][ dependency.name ] = dependency.spec;
    mutated = true;

  } );

  return {
    packageJson,
    mutated
  };
}

export function remove(
  packageJson: Object,
  removedPackages: string[],
  saveType: ?DependenciesType
): { packageJson: Object, mutated: boolean } {
  const types = saveType ? [ saveType ] : dependenciesTypes;
  let mutated = false;

  types.forEach( deptype => {
    if ( packageJson[ deptype ] ) {
      removedPackages.forEach( name => {
        if ( delete packageJson[ deptype ][ name ] ) {
          mutated = true;
        }
      } );
    }
  } );

  return {
    packageJson,
    mutated
  };
}
