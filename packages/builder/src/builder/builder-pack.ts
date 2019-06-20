import { Options, Info, ToWrite, FinalAsset, ProcessedGraph } from "../types";
import { resolvePath, relative } from "../utils/path";
import { ComputationCancelled } from "../utils/computation";
import { createRuntime, RuntimeInfo, createRuntimeManifest } from "../runtime/create-runtime";
import hash from "../utils/hash";
import { BuilderUtil } from "../plugins/context";
import { Builder, Build } from "./builder";
import { sourceMapToString, sourceMapToUrl } from "@quase/source-map";
import path from "path";

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

function addHash( file: string, h: string ): string {
  return file.replace( rehash, m => ( m ? `.${h}` + m : `-${h}` ) );
}

export class BuilderPack {

  private builder: Builder;
  private options: Options;
  private previousFiles: Map<string, FinalAsset>;

  constructor( builder: Builder ) {
    this.builder = builder;
    this.options = builder.options;
    this.previousFiles = new Map();
  }

  private createRuntime( info: RuntimeInfo ) {
    return createRuntime( {
      hmr: this.builder.hmrOptions,
      browser: this.options.runtime.browser,
      node: this.options.runtime.node,
      worker: this.options.runtime.worker
    }, info );
  }

  private async writeAsset( asset: FinalAsset, { data, map }: ToWrite ): Promise<Info> {

    let dest = path.join( this.options.dest, asset.relativeDest );
    const fs = this.options.fs;
    const inlineMap = this.options.optimization.sourceMaps === "inline";
    const directory = path.dirname( dest );

    if ( map ) {
      map.sources = map.sources.map(
        ( source: string ) => relative( resolvePath( source, this.options.cwd ), directory )
      );
    }

    if ( map && typeof data === "string" ) {
      if ( inlineMap ) {
        map.file = undefined;
        data += `\n//# ${SOURCE_MAP_URL}=${sourceMapToUrl( map )}`;
      } else {
        data += `\n//# ${SOURCE_MAP_URL}=`;
      }
    }

    let h = null;
    if ( this.options.optimization.hashing && !asset.isEntry ) {
      h = hash( data );
      asset.relativeDest = addHash( asset.relativeDest, h );
      dest = path.join( this.options.dest, asset.relativeDest );
      if ( !inlineMap && map && typeof map.file === "string" ) {
        map.file = addHash( map.file, h );
      }
    }

    asset.hash = h;

    await fs.mkdirp( directory );

    if ( map && typeof data === "string" ) {
      if ( inlineMap ) {
        await fs.writeFile( dest, data );
      } else {
        const p1 = fs.writeFile( dest, data + `${path.basename( dest )}.map` );
        const p2 = fs.writeFile( dest + ".map", sourceMapToString( map ) );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( dest, data );
    }

    return {
      file: dest,
      hash: h,
      size: data.length,
      isEntry: asset.isEntry
    };
  }

  private async render( asset: FinalAsset ): Promise<Info> {
    const manifest = createRuntimeManifest( asset.manifest );

    if ( asset.isEntry ) {
      const code = await this.createRuntime( {
        context: this.options.dest,
        fullPath: path.join( this.options.dest, asset.relativeDest ),
        publicPath: this.options.publicPath,
        minify: this.options.mode !== "development"
      } );
      asset.runtime = {
        manifest,
        code
      };
    } else {
      asset.runtime.manifest = manifest;
    }

    const { result } =
      await this.builder.pluginsRunner.renderAsset( asset, new BuilderUtil( this.options ) );

    if ( result ) {
      return this.writeAsset( asset, result );
    }
    throw new Error( `Could not build asset ${asset.module.id}` );
  }

  private checkIfCancelled( build: Build ) {
    if ( this.builder.build !== build ) {
      throw new ComputationCancelled();
    }
  }

  private wait<T>( build: Build, p: Promise<T> ) {
    this.checkIfCancelled( build );
    return p;
  }

  private shouldRebuild( oldFile: FinalAsset | undefined, newFile: FinalAsset ): boolean {
    if (
      !oldFile ||
      oldFile.srcs.size !== newFile.srcs.size ||
      oldFile.inlineAssets.length !== newFile.inlineAssets.length ||
      oldFile.manifest.files.length !== newFile.manifest.files.length
    ) {
      return true;
    }
    for ( const [ key, newArr ] of newFile.manifest.moduleToAssets ) {
      const oldArr = oldFile.manifest.moduleToAssets.get( key );
      if ( !oldArr || oldArr.length !== newArr.length ) {
        return true;
      }
      for ( let i = 0; i < oldArr.length; i++ ) {
        const a = oldArr[ i ];
        const b = newArr[ i ];
        if ( a !== b ) {
          return true;
        }
      }
    }
    for ( const [ key, newM ] of newFile.srcs ) {
      const oldM = oldFile.srcs.get( key );
      if (
        !oldM ||
        oldM.transformedBuildId !== newM.transformedBuildId ||
        oldM.requires.length !== newM.requires.length
      ) {
        return true;
      }
      // If the module's code didn't change (per transformedBuildId)
      // then we just need to check if the dependencies are the same.
      // We assume that if something changed order in this array,
      // then something actually changed and needs update so,
      // doing a linear check is enough.
      for ( let i = 0; i < oldM.requires.length; i++ ) {
        const a = oldM.requires[ i ];
        const b = newM.requires[ i ];
        if ( a.id !== b.id || a.hashId !== b.hashId || a.async !== b.async ) {
          return true;
        }
      }
    }
    const oldInlineAssets = new Map( oldFile.inlineAssets.map( a => [ a.module.id, a ] ) );
    for ( const a of newFile.inlineAssets ) {
      if ( this.shouldRebuild( oldInlineAssets.get( a.module.id ), a ) ) {
        return true;
      }
    }
    return false;
  }

  async run( build: Build, processedGraph: ProcessedGraph ) {

    const files = processedGraph.files.filter(
      f => this.shouldRebuild( this.previousFiles.get( f.module.id ), f )
    );

    const filesInfo = await this.wait( build,
      Promise.all( files.map( a => this.render( a ) ) )
    );

    this.previousFiles = new Map( processedGraph.files.map( v => [ v.module.id, v ] ) );

    return filesInfo;
  }

}
