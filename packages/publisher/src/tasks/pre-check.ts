import { Options, GitOptions } from "../types";
import { l, error } from "../util/util";
import * as git from "../util/git";
import * as npm from "../util/npm";
import * as version from "../util/version";

// Adapted from https://github.com/sindresorhus/np

export default function( opts: Options ) {
  const pkg = opts.pkg;

  const tasks = [
    {
      title: "Ping npm registry",
      skip: () => pkg.private || npm.isExternalRegistry( pkg ),
      task: () => npm.checkConnection()
    },
    {
      title: "Verify user is authenticated",
      skip: () => process.env.NODE_ENV === "test" || pkg.private,
      task: async() => {
        const username = await npm.username( {
          externalRegistry: npm.isExternalRegistry( pkg ) ? pkg.publishConfig.registry : false
        } );
        const collaborators = await npm.collaborators( pkg.name );
        if ( !collaborators ) {
          return;
        }
        const json = JSON.parse( collaborators );
        const permissions = json[ username ];
        if ( !permissions || !permissions.includes( "write" ) ) {
          throw error( "You do not have write permissions required to publish this package." );
        }
      }
    },
    {
      title: "Check git remote",
      enabled: () => opts.git.check && opts.git.push,
      task: () => git.verifyRemoteIsValid()
    },
    {
      title: "Validate version",
      task: () => {
        if ( !version.isValidVersionInput( opts.version ) ) {
          throw error( `Version should be either ${version.SEMVER_INCREMENTS.join( ", " )}, or a valid semver version.` );
        }

        opts.version = version.getNewVersion( pkg.version, opts.version );

        if ( !version.isVersionGreater( pkg.version, opts.version ) ) {
          throw error( `New version \`${opts.version}\` should be higher than current version \`${pkg.version}\`` );
        }
      }
    },
    {
      title: "Check for pre-release version",
      task: () => {
        if ( !pkg.private && version.isPrereleaseVersion( opts.version ) ) {
          if ( !opts.tag ) {
            throw error( "You must specify a dist-tag using --tag when publishing a pre-release version. https://docs.npmjs.com/cli/dist-tag" );
          }
          if ( opts.tag === "latest" ) {
            throw error( "It's not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`." );
          }
        }
      }
    },
    {
      title: "Check git tag existence",
      enabled: () => opts.git.commitAndTag && !!opts.git.tagPrefix,
      task: async() => {
        await git.fetch();
        await git.verifyTagDoesNotExistOnRemote( git.createTag( opts as Options & { git: GitOptions & { tagPrefix: string } } ) );
      }
    }
  ];

  return l( tasks );
}
