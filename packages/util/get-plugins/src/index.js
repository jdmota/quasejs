// @flow
const _resolveFrom = require( "resolve-from" );

export function requireRelative( m: string, cwd: ?string ) {
  // $FlowIgnore
  return require( _resolveFrom( cwd || process.cwd(), m ) );
}

type Plugin = {
  plugin: any,
  name: ?string,
  key: ?string,
  options: Object
};

type ProvidedPlugin = string | Function | [string | Function, ?Object];

type ProvidedPlugins = $ReadOnlyArray<?ProvidedPlugin>;

const regexp = /^([^]+)\[([^[\]]+)\]$/;

export function getOnePlugin( p: ProvidedPlugin, cwd: ?string ): Plugin {
  let plugin, name, key, options;

  if ( Array.isArray( p ) ) {
    plugin = p[ 0 ];
    options = Object.assign( {}, p[ 1 ] );
  } else {
    plugin = p;
    options = {};
  }

  if ( typeof plugin === "string" ) {
    const m = plugin.match( regexp );

    if ( m ) {
      name = m[ 1 ];
      key = m[ 2 ].trim();
    } else {
      name = plugin;
      key = "default";
    }

    plugin = requireRelative( name, cwd );

    if ( plugin ) {
      if ( key === "default" ) {
        plugin = plugin.__esModule ? plugin.default : plugin;
      } else {
        plugin = plugin[ key ];
      }
    }
  }

  return {
    plugin,
    name,
    key,
    options
  };
}

export function getPlugins( provided: ProvidedPlugins, cwd: ?string ): Plugin[] {
  const plugins = [];
  for ( const p of provided ) {
    if ( p ) {
      plugins.push( getOnePlugin( p, cwd ) );
    }
  }
  return plugins;
}
