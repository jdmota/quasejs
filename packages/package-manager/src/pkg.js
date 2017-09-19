// @flow
// Adapted from pnpm/supi

const readPkg = require( "read-pkg" );
const writePkg = require( "write-pkg" );
const normalize = require( "normalize-package-data" );

type DependenciesType = "dependencies" | "devDependencies" | "optionalDependencies";
const dependenciesTypes: DependenciesType[] = [ "dependencies", "devDependencies", "optionalDependencies" ];

/* function getSaveType( opts ): DependenciesType | void {
  if ( opts.saveDev ) return "devDependencies";
  if ( opts.saveOptional ) return "optionalDependencies";
  if ( opts.saveProd ) return "dependencies";
} */

function guessDependencyType( name: string, pkg: Object ): DependenciesType {
  return dependenciesTypes.find( type => Boolean( pkg[ type ] && pkg[ type ][ name ] ) ) || "dependencies";
}

export async function read( folder: string ): Promise<Object> {
  const x = await readPkg( folder, { normalize: false } );
  normalize( x );
  return x;
}

export async function write( folder: string, json: Object ) {
  return writePkg( folder, json );
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
