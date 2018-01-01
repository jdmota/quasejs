const util = require( "np/lib/util" );
const ui = require( "np/lib/ui" );

export default async function( opts ) {
  const prevReadPkg = util.readPkg;
  util.readPkg = () => opts.pkg;
  const uiPromise = ui( opts );
  util.readPkg = prevReadPkg;

  const { version, tag } = await uiPromise;
  opts.version = version;
  opts.tag = tag;
}
