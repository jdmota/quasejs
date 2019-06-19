import arrayConcat from "../../utils/array-concat";
import { ImportedName, ExportedName, Dep, Transformer } from "../../types";
import babelPluginModules from "../utils/babel-plugin-transform-modules";
import extractNames from "../utils/ast-extract-names";

type MutableDepsInfo = {
  dependencies: Map<string, Dep>;
  importedNames: ImportedName[];
  exportedNames: ExportedName[];
};

const importLazy = require( "import-lazy" )( require );
const babel = importLazy( "@babel/core" );

function getLoc( node: any ) {
  return node.loc && node.loc.start;
}

function addDep( deps: any, source: any, async: boolean ) {
  const curr = deps.dependencies.get( source.value );
  if ( curr ) {
    if ( !async && curr.async ) {
      deps.dependencies.set( source.value, {
        loc: getLoc( source ),
        async
      } );
    }
  } else {
    deps.dependencies.set( source.value, {
      loc: getLoc( source ),
      async
    } );
  }
}

function extractor( deps: MutableDepsInfo, node: any, opts: any = {} ) {

  if ( opts.require ) {
    addDep( deps, node.arguments[ 0 ], false );
    return;
  }

  if ( opts.commonjs ) {
    deps.exportedNames.push( { name: "default", loc: getLoc( node ) } );
    return;
  }

  const { type } = node;

  if ( type === "ImportDeclaration" ) {

    const request = node.source.value;
    addDep( deps, node.source, false );

    node.specifiers.forEach( ( s: any ) => {
      const loc = getLoc( s );
      if ( s.type === "ImportDefaultSpecifier" ) {
        deps.importedNames.push( {
          imported: "default",
          name: s.local.name,
          request,
          loc
        } );
      } else if ( s.type === "ImportNamespaceSpecifier" ) {
        deps.importedNames.push( {
          imported: "*",
          name: s.local.name,
          request,
          loc
        } );
      } else {
        deps.importedNames.push( {
          imported: s.imported.name,
          name: s.local.name,
          request,
          loc
        } );
      }
    } );

  } else if ( type === "ExportNamedDeclaration" ) {

    if ( node.declaration ) {
      arrayConcat(
        deps.exportedNames,
        extractNames( node.declaration ).map(
          name => ( { name, loc: getLoc( node.declaration ) } )
        )
      );
    } else {
      const request = node.source && node.source.value;
      if ( node.source ) {
        addDep( deps, node.source, false );
      }
      node.specifiers.forEach( ( s: any ) => {
        const loc = getLoc( s );
        if ( s.type === "ExportDefaultSpecifier" ) { // https://github.com/leebyron/ecmascript-export-default-from
          deps.exportedNames.push( {
            name: s.exported.name,
            imported: "default",
            request,
            loc
          } );
        } else if ( s.type === "ExportNamespaceSpecifier" ) { // https://github.com/leebyron/ecmascript-export-ns-from
          deps.exportedNames.push( {
            name: s.exported.name,
            imported: "*",
            request,
            loc
          } );
        } else {
          deps.exportedNames.push( {
            name: s.exported.name,
            imported: s.local.name,
            request,
            loc
          } );
        }
      } );
    }

  } else if ( type === "ExportDefaultDeclaration" ) {

    deps.exportedNames.push( { name: "default", loc: getLoc( node ) } );

  } else if ( type === "ExportAllDeclaration" ) {

    addDep( deps, node.source, false );

    deps.exportedNames.push( {
      name: "*",
      imported: "*",
      request: node.source.value,
      loc: getLoc( node )
    } );

  } else if ( type === "CallExpression" ) {

    if ( node.callee.type === "Import" ) {
      const arg = node.arguments[ 0 ];
      if ( arg.type === "StringLiteral" ) {
        addDep( deps, arg, true );
      }
    }

    // TODO support globs

  }

}

const TRANSFORMER_NAME = "quase_builder_js_transformer";

export const transformer: Transformer = {

  name: TRANSFORMER_NAME,

  async parse( options, asset, module ) {
    const program = await babel.parseAsync(
      module.dataToString( asset.data ),
      Object.assign( {
        babelrc: false,
        configFile: false,
        sourceType: "module",
        parserOpts: {
          sourceType: "module",
          plugins: [
            "dynamicImport",
            "importMeta",
            "exportDefaultFrom",
            "exportNamespaceFrom"
          ]
        },
        filename: module.relativePath,
        filenameRelative: module.path
      }, options )
    );

    return {
      type: "babel",
      version: "7",
      isDirty: false,
      program
    };
  },

  async transform( _options, asset, module ) {

    if ( !asset.ast ) {
      return asset;
    }

    const varsUsed = {};
    const imports: any[] = [];
    const deps: MutableDepsInfo = {
      dependencies: new Map(),
      importedNames: [],
      exportedNames: []
    };

    const opts = {
      babelrc: false,
      configFile: false,
      sourceType: "module",
      parserOpts: {
        sourceType: "module",
        plugins: [
          "dynamicImport",
          "importMeta",
          "exportDefaultFrom",
          "exportNamespaceFrom"
        ]
      },
      filename: module.relativePath,
      filenameRelative: module.path,
      code: false,
      ast: true,
      sourceMaps: false,
      plugins: [
        [ babelPluginModules, {
          hmr: module.builderOptions.hmr,
          varsUsed,
          extractor: extractor.bind( null, deps ),
          extractModuleSource( stringLiteral: any ) {
            imports.push( {
              source: stringLiteral.value,
              stringLiteral
            } );
          }
        } ]
      ]
    };

    const { ast: newAst } = await babel.transformFromAstAsync( asset.ast.program, "", opts );

    asset.type = "js";
    asset.depsInfo = deps;
    asset.ast.program = newAst;
    asset.ast.isDirty = true;
    newAst._meta = {
      varsUsed,
      imports,
      deps
    };
    return asset;
  }

};

export default transformer;
