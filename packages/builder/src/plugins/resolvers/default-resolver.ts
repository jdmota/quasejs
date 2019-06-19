import { Resolver } from "../../types";

const path = require( "path" );

const RESOLVER_NAME = "quase_builder_default_resolver";

export const resolver: Resolver = {
  name: RESOLVER_NAME,
  async resolve( _options, importee, importerModule ) {
    const importer = importerModule.path;
    const resolved = path.resolve( path.dirname( importer ), importee );
    const isFile = await importerModule.isFile( resolved );
    return isFile && resolved;
  }
};

export default resolver;
