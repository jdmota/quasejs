import blank from "../utils/blank";
import astExtractNames from "./ast-extract-names";

const { basename, extname } = require( "path" );
const template = require( "@babel/template" ).default;

const vars = {
  exports: "$e",
  require: "$r",
  import: "$i",
  export: "$g",
  exportAll: "$a"
};

const templates = {
  commonjs: template( `${vars.exports}.__esModule = false;` ),
  require: template( `${vars.require}($0);` ),
  exportsGetter: template( `${vars.export}(${vars.exports}, $0, function() { return $1; } );` ),
  exportsAssignment: template( `${vars.exports}.$0 = $1;` ),
  exportsDefaultsAssignment: template( `${vars.exports}.default = { default: $0 }.default;` ),
  exportsDefaultsMember: template( `${vars.exports}.default` ),
  exportAll: template( `${vars.exportAll}(${vars.exports}, $0)` )
};

const THIS_BREAK_KEYS = [ "FunctionExpression", "FunctionDeclaration", "ClassProperty", "ClassMethod", "ObjectMethod" ];

export default ( { types: t }, options ) => {

  const REQUIRES = Symbol();
  const TOP_NODES = Symbol();
  const extractor = options.extractor || ( () => {} );
  const resolveModuleSource = options.resolveModuleSource || ( x => x );
  const varsUsed = options.varsUsed || {};

  function getVar( name ) {
    varsUsed[ vars[ name ] ] = true;
    return vars[ name ];
  }

  function runTemplate( name, arg1, arg2 ) {
    switch ( name ) {
      case "require":
        varsUsed[ vars.require ] = true;
        break;
      case "exportsGetter":
        varsUsed[ vars.export ] = true;
        varsUsed[ vars.exports ] = true;
        break;
      case "commonjs":
      case "exportsAssignment":
      case "exportsDefaultsAssignment":
      case "exportsDefaultsMember":
        varsUsed[ vars.exports ] = true;
        break;
      case "exportAll":
        varsUsed[ vars.exportAll ] = true;
        varsUsed[ vars.exports ] = true;
        break;
      default:
    }
    return templates[ name ]( [ arg1, arg2 ].filter( Boolean ) );
  }

  function remapImport( path, newNode ) {
    if ( path.parentPath.isCallExpression( { callee: path.node } ) ) {
      path.replaceWith( t.sequenceExpression( [ t.numericLiteral( 0 ), newNode ] ) );
    } else if ( path.isJSXIdentifier() ) {
      const { object, property } = newNode;
      path.replaceWith( t.JSXMemberExpression( t.JSXIdentifier( object.name ), t.JSXIdentifier( property.name ) ) );
    } else {
      path.replaceWith( newNode );
    }
  }

  function exitContext( path ) {
    if ( path[ TOP_NODES ] ) {
      const [ requires, exportAll, others ] = path[ TOP_NODES ];
      const topNodes = requires.map( entry => ( entry.onlySideEffects ? entry.varDeclOnlyEffect : entry.varDecl ) ).concat( exportAll, others );
      path[ TOP_NODES ] = null;

      if ( path.isSwitchCase() ) {
        path.unshiftContainer( "consequent", topNodes );
      } else { // path.isProgram() || path.isBlockStatement()
        path.unshiftContainer( "body", topNodes );
      }
    }
  }

  function wrapInBlock( path ) {
    let context = getContext( path );
    if ( context.isProgram() || context.isBlockStatement() || context.isSwitchCase() ) {
      return path;
    }
    const c = context.isIfStatement() ? context.get( "consequent" ) : context.get( "body" );
    c.replaceWith( t.blockStatement( [ c.node ] ) );
    return c.get( "body.0" );
  }

  function getContext( path ) {
    let parentPath = path.parentPath;

    while ( parentPath ) {
      /* istanbul ignore else */
      if ( parentPath.isProgram() || parentPath.isStatement() || parentPath.isSwitchCase() ) {
        return parentPath;
      }
      /* istanbul ignore next */
      parentPath = parentPath.parentPath;
    }
  }

  return {

    name: "quase-builder-babel-plugin",

    pre() {
      this.remaps = blank();

      this.insertOnTop = ( path, node, level ) => {
        const context = getContext( path );
        if ( !context[ TOP_NODES ] ) {
          context[ TOP_NODES ] = [ [], [], [] ];
        }
        context[ TOP_NODES ][ level == null ? 2 : level ].push( node );
      };

      this.addRequire = ( path, onlySideEffects ) => {

        const { node } = path;
        const originalSource = node.source.value;
        const source = resolveModuleSource( node.source.value );
        const blockHoist = node._blockHoist;

        const context = getContext( path );
        let ctx = context;

        while ( ctx ) {
          if ( ctx[ REQUIRES ] && ctx[ REQUIRES ][ source ] ) {
            const entry = ctx[ REQUIRES ][ source ];
            if ( typeof blockHoist === "number" ) {
              entry.varDecl._blockHoist = entry.varDeclOnlyEffect._blockHoist = Math.max( blockHoist, entry.varDecl._blockHoist );
            }
            if ( !onlySideEffects ) {
              entry.onlySideEffects = false;
            }
            return entry.uid;
          }
          ctx = getContext( ctx );
        }

        const uid = context.scope.generateUid( basename( originalSource, extname( originalSource ) ) );
        const ref = t.identifier( uid );

        if ( !context[ REQUIRES ] ) {
          context[ REQUIRES ] = blank();
        }

        const requireExpression = runTemplate( "require", t.stringLiteral( source ) ).expression;

        const varDecl = t.variableDeclaration( "var", [ t.variableDeclarator( ref, requireExpression ) ] );
        const varDeclOnlyEffect = t.expressionStatement( requireExpression );

        varDecl.loc = varDeclOnlyEffect.loc = node.source.loc;

        if ( typeof blockHoist === "number" && blockHoist > 0 ) {
          varDecl._blockHoist = varDeclOnlyEffect._blockHoist = blockHoist;
        }

        const entry = context[ REQUIRES ][ source ] = { uid, varDecl, varDeclOnlyEffect, onlySideEffects };

        this.insertOnTop( path, entry, 0 );

        return uid;

      };

      this.visitorReferencedIdentifier = path => {
        const { node, scope } = path;
        const name = node.name;
        const remaps = this.remaps[ name ] || [];

        for ( let i = 0; i < remaps.length; i++ ) {
          const [ requireScope, member ] = remaps[ i ];
          if ( requireScope.getBinding( name ) === scope.getBinding( name ) ) {
            remapImport( path, member );
            return;
          }
        }
      };

    },

    post() {
      this.remaps = null;
    },

    visitor: {

      Scope( { scope } ) {
        for ( const name in vars ) {
          scope.rename( vars[ name ] );
        }
      },

      // Adapted from https://github.com/babel/babel/tree/7.0/packages/babel-plugin-transform-es2015-modules-commonjs
      ThisExpression( path ) {
        if ( !path.findParent( path => !path.is( "shadow" ) && THIS_BREAK_KEYS.indexOf( path.type ) >= 0 ) ) {
          path.replaceWith( t.identifier( "undefined" ) );
        }
      },

      Program: {
        exit( path ) {
          if ( this.commonjs ) {
            path.unshiftContainer( "body", [
              runTemplate( "commonjs" ),
              runTemplate( "exportsDefaultsAssignment", t.objectExpression( [] ) )
            ] );
          }

          // Remove "use strict" that other plugins added. We can insert it later on top of the final file.
          const { node } = path;
          node.directives = node.directives.filter( ( { value } ) => ( value.value !== "use strict" ) );

          exitContext( path );

          path.traverse( {
            // Workaround an babel issue
            // http://astexplorer.net/#/gist/1b36bf4153c7118db78fcbeda5f5bd9c/410f70d5e6f6bc0a27d9754730de3f99f93a684f
            JSXIdentifier: path => {
              if ( !path.parentPath.isJSXMemberExpression() || path.parentKey !== "property" ) {
                this.visitorReferencedIdentifier( path );
              }
            },

            ReferencedIdentifier: this.visitorReferencedIdentifier
          } );
        }
      },

      BlockStatement: {
        exit: exitContext
      },

      SwitchCase: {
        exit: exitContext
      },

      ImportDeclaration( path ) {
        extractor( path.node );

        path = wrapInBlock( path );

        const { node, scope } = path;
        const { specifiers } = node;
        const uid = this.addRequire( path, specifiers.length === 0 );

        for ( let i = 0; i < specifiers.length; i++ ) {
          const specifier = specifiers[ i ];

          switch ( specifier.type ) {
            case "ImportSpecifier":
            case "ImportDefaultSpecifier": {

              const localName = specifier.local.name;
              const importedName = specifier.imported ? specifier.imported.name : "default";

              const member = t.memberExpression( t.identifier( uid ), t.identifier( importedName ) );
              member.loc = specifier.loc;

              if ( !scope.bindings[ localName ] ) {
                scope.moveBindingTo( localName, scope );
              }

              if ( !this.remaps[ localName ] ) {
                this.remaps[ localName ] = [];
              }
              this.remaps[ localName ].push( [ scope, member ] );

              break;
            }
            default: { // "ImportNamespaceSpecifier"
              const varDecl = t.variableDeclaration( "var", [
                t.variableDeclarator( specifier.local, t.identifier( uid ) )
              ] );
              this.insertOnTop( path, varDecl );
              varDecl.loc = specifier.loc;
            }
          }
        }

        path.remove();

      },

      ExportNamedDeclaration( path ) {
        extractor( path.node );

        path = wrapInBlock( path );

        const declarationPath = path.get( "declaration" );
        const declaration = declarationPath.node;

        if ( declaration ) {

          if ( declarationPath.isFunctionDeclaration() || declarationPath.isClassDeclaration() ) {

            const id = declaration.id;
            this.insertOnTop( path, runTemplate( "exportsGetter", t.stringLiteral( id.name ), id ) );

          } else { // declarationPath.isVariableDeclaration()

            astExtractNames( declaration ).forEach( name => {
              this.insertOnTop( path, runTemplate( "exportsGetter", t.stringLiteral( name ), t.identifier( name ) ) );
            } );

          }

          path.replaceWith( declaration );

        } else {

          const specifiersPath = path.get( "specifiers" );
          const source = path.node.source;

          if ( source ) {

            const uid = this.addRequire( path, path.node.specifiers.length === 0 );

            for ( const specifier of specifiersPath ) {
              const exportedName = specifier.node.exported.name;
              let localName;

              if ( specifier.isExportNamespaceSpecifier() ) {
                localName = uid;
              } else if ( specifier.isExportDefaultSpecifier() ) {
                localName = "default";
              } else { // specifier.isExportSpecifier()
                localName = specifier.node.local.name;
              }

              const exporter = specifier.isExportNamespaceSpecifier() ?
                runTemplate( "exportsAssignment", t.identifier( exportedName ), t.identifier( localName ) ) :
                runTemplate( "exportsGetter", t.stringLiteral( exportedName ), t.memberExpression( t.identifier( uid ), t.identifier( localName ) ) );

              this.insertOnTop( path, exporter );
              exporter.loc = specifier.node.loc;

            }
          } else {
            for ( const specifier of specifiersPath ) {
              const exporter = runTemplate( "exportsGetter", t.stringLiteral( specifier.node.exported.name ), specifier.node.local );
              this.insertOnTop( path, exporter );
              exporter.loc = specifier.node.loc;
            }
          }

          path.remove();

        }

      },

      ExportDefaultDeclaration( path ) {
        extractor( path.node );

        path = wrapInBlock( path );

        // http://stackoverflow.com/questions/39276608/is-there-a-difference-between-export-default-x-and-export-x-as-default/39277065#39277065

        const declarationPath = path.get( "declaration" );
        const declaration = declarationPath.node;

        if ( declarationPath.isFunctionDeclaration() || declarationPath.isClassDeclaration() ) {

          const id = declaration.id;

          if ( id ) {
            const exporter = runTemplate( "exportsGetter", t.stringLiteral( "default" ), id );
            this.insertOnTop( path, exporter );
            exporter.loc = path.node.loc;
            path.replaceWith( declaration );
          } else {
            const exporter = runTemplate( "exportsDefaultsAssignment", t.toExpression( declaration ) );
            this.insertOnTop( path, exporter );
            exporter.loc = path.node.loc;
            path.remove();
          }

        } else {

          path.replaceWith( runTemplate( "exportsAssignment", t.identifier( "default" ), declaration ) );

        }

      },

      ExportAllDeclaration( path ) {
        extractor( path.node );

        path = wrapInBlock( path );

        const uid = this.addRequire( path, false );
        const exportNode = runTemplate( "exportAll", t.identifier( uid ) );
        this.insertOnTop( path, exportNode, 1 );
        exportNode.loc = path.node.loc;
        path.remove();
      },

      CallExpression( path ) {

        const { node } = path;
        const callee = path.get( "callee" );

        if ( node.callee.type === "Import" ) {
          extractor( node );

          callee.replaceWith( t.identifier( getVar( "import" ) ) );

          const arg = node.arguments[ 0 ];

          if ( arg && arg.type === "StringLiteral" ) {
            arg.value = resolveModuleSource( arg.value );
          }
        } else if ( node.callee.type === "Identifier" ) {

          if ( checkGlobal( callee, "require" ) && node.arguments[ 0 ].type === "StringLiteral" ) {

            extractor( node, { require: true } );
            node.arguments[ 0 ].value = resolveModuleSource( node.arguments[ 0 ].value );

            callee.replaceWith( t.memberExpression(
              t.identifier( getVar( "require" ) ),
              t.identifier( "r" )
            ) );
          }

        }

      },

      MemberExpression( path ) {
        const { node } = path;
        const { object, property } = node;

        if (
          path.get( "object" ).isIdentifier() &&
          path.get( "property" ).isIdentifier() &&
          object.name === "module" &&
          property.name === "exports" &&
          !path.scope.hasBinding( "module" )
        ) {
          this.commonjs = true;
          const newNode = runTemplate( "exportsDefaultsMember" );
          newNode.loc = node.loc;
          extractor( node, { commonjs: true } );
          path.replaceWith( newNode );
        }
      },

      Identifier( path ) {
        const { node } = path;

        if ( checkGlobal( path, "exports" ) ) {
          this.commonjs = true;
          const newNode = runTemplate( "exportsDefaultsMember" );
          newNode.loc = node.loc;
          extractor( node, { commonjs: true } );
          path.replaceWith( newNode );
        }
      }
    }
  };
};

function checkGlobal( path, name ) {
  return path.node.name === name &&
    path.parentPath.isExpression() &&
    !( path.parentKey === "property" && path.parentPath.isMemberExpression() ) &&
    !path.scope.hasBinding( name );
}
