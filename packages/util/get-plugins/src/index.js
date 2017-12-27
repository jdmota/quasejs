// @flow

const relative = require( "require-relative" );

export function requireRelative( m: string ) {
  // $FlowFixMe
  return require( relative.resolve( m, process.cwd() ) );
}

type Plugin = {
  plugin: any,
  name: ?string,
  options: Object
};

type ProvidedPlugins = $ReadOnlyArray<?string | Function | [string | Function, ?Object]>;

export function getPlugins( provided: ProvidedPlugins, requireFn: ?Function ): Plugin[] {
  const plugins = [];

  for ( const l of provided ) {
    let plugin, name, opts;

    if ( !l ) {
      continue;
    }

    if ( Array.isArray( l ) ) {
      plugin = l[ 0 ];
      opts = l[ 1 ];
    } else {
      plugin = l;
    }

    if ( typeof plugin === "string" ) {
      name = plugin;
      plugin = ( requireFn && requireFn( name ) ) || requireRelative( name );

      if ( plugin.default ) {
        plugin = plugin.default;
      }
    }

    plugins.push( {
      plugin,
      name,
      options: Object.assign( {}, opts )
    } );
  }

  return plugins;
}
