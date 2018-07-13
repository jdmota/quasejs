// @flow
import { check } from "../checker";
import { getType } from "../id";
import type { Plugin } from "../types";

const path = require( "path" );

export default function defaultPlugin(): Plugin {
  return {
    name: "quase_builder_internal_plugin",
    getType,
    check,
    load( path, module ) {
      return module.readFile( path );
    },
    resolve: {
      "*": async function( importee, importerModule ) {
        const importer = importerModule.path;
        const resolved = path.resolve( path.dirname( importer ), importee );
        const isFile = await importerModule.isFile( resolved );
        return isFile && resolved;
      }
    },
    isSplitPoint( required, module ) {
      return required.type !== module.type;
    }
  };
}
