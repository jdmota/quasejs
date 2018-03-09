import JsLanguage from "../languages/js";
import HtmlLanguage from "../languages/html";
import Language from "../language";
import { check } from "../checker";
import { getType } from "../id";

export default function defaultPlugin() {
  return {
    name: "quase_builder_internal_plugin",
    async load( path, builder ) {
      return {
        type: getType( path ),
        data: await builder.fileSystem.readFile( path, path )
      };
    },
    getLanguage( module, builder ) {
      if ( module.type === "js" ) {
        return new JsLanguage( {}, module, builder );
      }
      if ( module.type === "html" ) {
        return new HtmlLanguage( {}, module, builder );
      }
      return new Language( {}, module, builder );
    },
    async resolve( importee, importerModule, builder ) {
      return importerModule.lang.resolve( importee, importerModule.path, builder );
    },
    isSplitPoint( required, module ) {
      return required.type !== module.type;
    },
    checker: check
  };
}
