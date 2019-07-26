import { Options, Info, ToWrite, FinalAsset, ProcessedGraph } from "../types";
import { resolvePath, relative } from "../utils/path";
import { createRuntime, RuntimeInfo, createRuntimeManifest } from "../runtime/create-runtime";
import hash from "../utils/hash";
import { BuilderUtil } from "../plugins/context";
import { Builder } from "./builder";
import { sourceMapToString, sourceMapToUrl } from "@quase/source-map";
import path from "path";
import fs from "fs-extra";
import { KeyToArray } from "../utils/key-to-array";

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

function addHash( file: string, h: string ): string {
  return file.replace( rehash, m => ( m ? `.${h}` + m : `-${h}` ) );
}

export class BuilderPack {

  private builder: Builder;
  private options: Options;
  private previousFiles: Map<string, FinalAsset>;
  private allWrittenFiles: KeyToArray<string, string>;

  constructor( builder: Builder ) {
    this.builder = builder;
    this.options = builder.options;
    this.previousFiles = new Map();
    this.allWrittenFiles = new KeyToArray();
  }

  private createRuntime( info: RuntimeInfo ) {
    return createRuntime( {
      hmr: this.builder.hmrOptions,
      browser: this.options.runtime.browser,
      node: this.options.runtime.node,
      worker: this.options.runtime.worker
    }, info );
  }

  private async writeAsset(
    asset: FinalAsset, { data, map }: ToWrite,
    currWrittenFiles: KeyToArray<string, string>
  ): Promise<Info> {

    let dest = path.join( this.options.dest, asset.relativeDest );
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

    this.allWrittenFiles.set( asset.module.id, dest );
    currWrittenFiles.set( asset.module.id, dest );

    await fs.mkdirp( directory );

    if ( map && typeof data === "string" ) {
      if ( inlineMap ) {
        await fs.writeFile( dest, data );
      } else {
        this.allWrittenFiles.set( asset.module.id, dest + ".map" );
        currWrittenFiles.set( asset.module.id, dest + ".map" );

        const p1 = fs.writeFile( dest, data + `${path.basename( dest )}.map` );
        const p2 = fs.writeFile( dest + ".map", sourceMapToString( map ) );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( dest, data );
    }

    return {
      moduleId: asset.module.id,
      file: dest,
      hash: h,
      size: data.length,
      isEntry: asset.isEntry
    };
  }

  private async render(
    asset: FinalAsset,
    hashIds: ReadonlyMap<string, string>,
    currWrittenFiles: KeyToArray<string, string>
  ): Promise<Info> {
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
      await this.builder.pluginsRunner.renderAsset( asset, hashIds, new BuilderUtil( this.options ) );

    if ( result ) {
      return this.writeAsset( asset, result, currWrittenFiles );
    }
    throw new Error( `Could not build asset ${asset.module.id}` );
  }

  private shouldRebuild( processedGraph: ProcessedGraph, oldFile: FinalAsset | undefined, newFile: FinalAsset ): boolean {
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
        oldM.transformedId !== newM.transformedId ||
        oldM.requires.length !== newM.requires.length
      ) {
        return true;
      }
      // If the module's code didn't change (per transformedId)
      // then we just need to check if the dependencies are the same.
      // We assume that if something changed order in this array,
      // then something actually changed and needs update so,
      // doing a linear check is enough.
      for ( let i = 0; i < oldM.requires.length; i++ ) {
        const a = oldM.requires[ i ];
        const b = newM.requires[ i ];
        if ( a.id !== b.id || a.async !== b.async ) {
          return true;
        }
        const aHashId = get( processedGraph.hashIds, a.id );
        const bHashId = get( processedGraph.hashIds, b.id );
        if ( aHashId !== bHashId ) {
          return true;
        }
      }
    }
    const oldInlineAssets = new Map( oldFile.inlineAssets.map( a => [ a.module.id, a ] ) );
    for ( const a of newFile.inlineAssets ) {
      if ( this.shouldRebuild( processedGraph, oldInlineAssets.get( a.module.id ), a ) ) {
        return true;
      }
    }
    return false;
  }

  async run( processedGraph: ProcessedGraph ) {

    const previousWrittenFiles = this.allWrittenFiles.allValues();
    const currWrittenFiles = new KeyToArray<string, string>();

    // See which assets we need to rerender
    const filesToRender = processedGraph.files.filter(
      f => this.shouldRebuild( processedGraph, this.previousFiles.get( f.module.id ), f )
    );

    // Render them
    const filesInfo = await Promise.all(
      filesToRender.map( a => this.render( a, processedGraph.hashIds, currWrittenFiles ) )
    );

    // Calculate which files to remove
    for ( const asset of processedGraph.files ) {
      const files = currWrittenFiles.get( asset.module.id ) || this.allWrittenFiles.get( asset.module.id );
      for ( const file of files ) {
        previousWrittenFiles.delete( file );
      }
    }

    // Save current files for later
    this.previousFiles = new Map( processedGraph.files.map( v => [ v.module.id, v ] ) );

    // Removal of unnecessary files
    let removedCount = 0;

    await Promise.all(
      Array.from( previousWrittenFiles ).map( async file => {
        try {
          await fs.unlink( file );
          removedCount++;
        } catch ( err ) {
          if ( err.code !== "ENOENT" && err.code !== "EISDIR" ) {
            // Maybe we could not delete this file... Delete next time
            this.allWrittenFiles.set( "", file );
          }
        }
      } )
    );

    return {
      filesInfo,
      removedCount
    };
  }

}

function get<K, V>( map: ReadonlyMap<K, V>, key: K ): V {
  const value = map.get( key );
  if ( value ) {
    return value;
  }
  throw new Error( "Assertion error" );
}
