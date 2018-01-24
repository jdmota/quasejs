// @flow

const _resolveFrom = require( "resolve-from" );

export function requireRelative( m: string, cwd: ?string ) {
  // $FlowFixMe
  return require( _resolveFrom( cwd || process.cwd(), m ) );
}

type Plugin = {
  plugin: any,
  name: ?string,
  options: Object
};

type ProvidedPlugin = string | Function | [string | Function, ?Object];

type ProvidedPlugins = $ReadOnlyArray<?ProvidedPlugin>;

export function getOnePlugin( p: ProvidedPlugin, requireFn: ?Function ): Plugin {
  let plugin, name, opts;

  if ( Array.isArray( p ) ) {
    plugin = p[ 0 ];
    opts = p[ 1 ];
  } else {
    plugin = p;
  }

  if ( typeof plugin === "string" ) {
    name = plugin;
    plugin = requireFn && requireFn( name );

    if ( typeof plugin === "string" ) {
      name = plugin;
      plugin = requireRelative( name );
    } else if ( !plugin ) {
      plugin = requireRelative( name );
    }

    if ( plugin.default ) {
      plugin = plugin.default;
    }
  }

  return {
    plugin,
    name,
    options: Object.assign( {}, opts )
  };
}

export function getPlugins( provided: ProvidedPlugins, requireFn: ?Function ): Plugin[] {
  const plugins = [];
  for ( const p of provided ) {
    if ( p ) {
      plugins.push( getOnePlugin( p, requireFn ) );
    }
  }
  return plugins;
}
