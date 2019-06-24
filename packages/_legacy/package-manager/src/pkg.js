// @flow
import { toStr } from "./types";
import { error } from "./utils";
import { parse, type Parsed } from "./resolve";

const readPkg = require( "read-pkg" );
const writePkg = require( "write-pkg" );
const semver = require( "semver" );
const { fixer } = require( "normalize-package-data" );

const mustFix = [ "fixNameField", "fixVersionField", "fixDependencies" ];

const thingsToFix = [
  "fixDescriptionField", "fixRepositoryField", "fixModulesField",
  "fixScriptsField", "fixFilesField", "fixBinField", "fixManField",
  "fixBugsField", "fixKeywordsField", "fixHomepageField",
  "fixLicenseField", "fixPeople", "fixTypos"
];

type DependenciesType = "dependencies" | "devDependencies" | "optionalDependencies";
const dependenciesTypes: DependenciesType[] = [ "dependencies", "devDependencies", "optionalDependencies" ];

export async function read(
  folder: string,
  ignoreValidation: ?boolean,
  normalize: ?boolean
): Promise<Object> {
  const x = await readPkg( { cwd: folder, normalize: false } );
  mustFix.forEach( f => fixer[ f ]( x, false ) );
  if ( normalize ) {
    thingsToFix.forEach( f => fixer[ f ]( x, false ) );
  }
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

export async function readGlobal( folder: string ): Promise<Object> {
  try {
    return await readPkg( { cwd: folder, normalize: false } );
  } catch ( err ) {
    if ( err.code === "ENOENT" ) {
      const GLOBAL_PKG = {
        private: true,
        name: "qpm_global",
        version: "0.1.0"
      };
      // It also makes sure the folder exists
      await writePkg( folder, GLOBAL_PKG, {
        normalize: false,
        detectIndent: false,
        indent: "  "
      } );
      return GLOBAL_PKG;
    }
    throw err;
  }
}

export async function write( folder: string, json: Object ) {
  return writePkg( folder, json );
}

export function iterate( obj: ?Object, cb: Parsed => void ) {
  if ( obj ) {
    for ( const alias in obj ) {
      cb( parse( alias, obj[ alias ] ) );
    }
  }
}

export function validate( pkg: Object ) {

  const { name, version } = pkg;

  iterate( pkg.dependencies, parsed => {
    const dep = toStr( parsed.alias );
    if ( dep === name ) {
      throw error( `${dep} cannot depend on himself. See dependencies` );
    }
    if ( pkg.devDependencies[ dep ] != null ) {
      throw error( `${dep} appears in both dependencies and devDependencies` );
    } else if ( pkg.optionalDependencies[ dep ] != null ) {
      throw error( `${dep} appears in both dependencies and optionalDependencies` );
    }
  } );

  iterate( pkg.devDependencies, parsed => {
    const dep = toStr( parsed.alias );
    if ( dep === name && semver.satisfies( version, parsed.version ) ) {
      throw error( `${dep} cannot depend on himself. See devDependencies` );
    }
    if ( pkg.optionalDependencies[ dep ] != null ) {
      throw error( `${dep} appears in both devDependencies and optionalDependencies` );
    }
  } );

  iterate( pkg.optionalDependencies, parsed => {
    const dep = toStr( parsed.alias );
    if ( dep === name ) {
      throw error( `${dep} cannot depend on himself. See optionalDependencies` );
    }
  } );

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
  packageSpecs: $ReadOnlyArray<{ +alias: string, +spec: string }>,
  saveType: ?DependenciesType
): $ReadOnlyArray<{ +alias: string, +spec: string }> {
  const added = [];

  for ( const dependency of packageSpecs ) {

    const type = saveType || guessDependencyType( dependency.alias, packageJson );

    if ( packageJson[ type ] ) {
      if ( packageJson[ type ][ dependency.alias ] === dependency.spec ) {
        continue;
      }
    } else {
      packageJson[ type ] = {};
    }

    for ( const t of dependenciesTypes ) {
      if ( t === type ) {
        packageJson[ type ][ dependency.alias ] = dependency.spec;
      } else {
        delete packageJson[ t ][ dependency.alias ];
      }
    }

    added.push( dependency );
  }

  return added;
}

export function remove(
  packageJson: Object,
  removedPackages: string[],
  saveType: ?DependenciesType
): $ReadOnlyArray<{ +alias: string, +spec: string }> {
  const types = saveType ? [ saveType ] : dependenciesTypes;
  const removed = [];

  for ( const deptype of types ) {
    if ( packageJson[ deptype ] ) {
      for ( const alias of removedPackages ) {
        const spec = packageJson[ deptype ][ alias ];
        if ( spec != null ) {
          delete packageJson[ deptype ][ alias ];
          removed.push( {
            alias,
            spec
          } );
        }
      }
    }
  }

  return removed;
}
