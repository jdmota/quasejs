// @flow

const path = require( "path" );

/* opaque */ type Name = string;
/* opaque */ type Version = string;
/* opaque */ type ExactVersion = string;
/* opaque */ type Resolved = string;
/* opaque */ type Integrity = string;

type ResolvedObj = {
  name: Name,
  version: ExactVersion,
  resolved: Resolved,
  integrity: Integrity,
  deps: { [name: Name]: Version }
};

export function pathJoin( a: string, b: string, c: Name ) {
  return path.join( a, b, c );
}

export type { Name, Version, ExactVersion, Resolved, Integrity, ResolvedObj };