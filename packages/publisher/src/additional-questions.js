import * as version from "./version";

const prettyVersionDiff = require( "pretty-version-diff" );
const execa = require( "execa" );
const inquirer = require( "inquirer" );
const turbocolor = require( "turbocolor" );
const npmName = require( "npm-name" );

// Adapted from https://github.com/sindresorhus/np

/* eslint-disable no-console */

export default function( opts ) {
  const pkg = opts.pkg;
  const oldVersion = pkg.version;

  console.log( `\nPublish a new version of ${turbocolor.bold.magenta( pkg.name )} ${turbocolor.dim( `(current: ${oldVersion})` )}\n` );

  const filter = input => ( version.isValidVersionInput( input ) ? version.getNewVersion( oldVersion, input ) : input );

  const prompts = [
    {
      type: "list",
      name: "version",
      message: "Select semver increment or specify new version",
      filter,
      when: () => !opts.version,
      pageSize: version.SEMVER_INCREMENTS.length + 2,
      choices: version.SEMVER_INCREMENTS
        .map( inc => ( {
          name: `${inc}    ${prettyVersionDiff( oldVersion, inc )}`,
          value: inc
        } ) )
        .concat( [
          new inquirer.Separator(),
          {
            name: "Other (specify)",
            value: null
          }
        ] )
    },
    {
      type: "input",
      name: "version",
      message: "Version",
      filter,
      when: answers => !opts.version && !answers.version,
      validate: input => {
        if ( !version.isValidVersionInput( input ) ) {
          return "Please specify a valid semver, for example, `1.2.3`. See http://semver.org";
        }

        if ( !version.isVersionGreater( oldVersion, input ) ) {
          return `Version must be greater than ${oldVersion}`;
        }

        return true;
      }
    },
    {
      type: "list",
      name: "tag",
      message: "How should this pre-release version be tagged in npm?",
      when: answers => !pkg.private && version.isPrereleaseVersion( answers.version || opts.version ) && !opts.tag,
      choices: () => execa.stdout( "npm", [ "view", "--json", pkg.name, "dist-tags" ] )
        .then( stdout => {
          const existingPrereleaseTags = Object.keys( JSON.parse( stdout ) )
            .filter( tag => tag !== "latest" );

          if ( existingPrereleaseTags.length === 0 ) {
            existingPrereleaseTags.push( "next" );
          }

          return existingPrereleaseTags
            .concat( [
              new inquirer.Separator(),
              {
                name: "Other (specify)",
                value: null
              }
            ] );
        } )
    },
    {
      type: "input",
      name: "tag",
      message: "Tag",
      when: answers => !pkg.private && version.isPrereleaseVersion( answers.version || opts.version ) && !opts.tag && !answers.tag,
      validate: input => {
        if ( input.length === 0 ) {
          return "Please specify a tag, for example, `next`.";
        }

        if ( input.toLowerCase() === "latest" ) {
          return "It's not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`.";
        }

        return true;
      }
    },
    {
      type: "list",
      name: "access",
      message: "This scoped repo was not published. What should be its access?",
      when: async() => !opts.access && !pkg.private && /^@/.test( pkg.name ) && !( await npmName( pkg.name ) ),
      choices: () => [
        {
          name: "Restricted",
          value: "restricted"
        },
        {
          name: "Public",
          value: "public"
        }
      ]
    },
    {
      type: "confirm",
      name: "confirm",
      message: answers => {
        const tag = answers.tag || opts.tag;
        const tagPart = tag ? ` and tag this release in npm as ${tag}` : "";

        return `Will bump from ${turbocolor.cyan( oldVersion )} to ${turbocolor.cyan( answers.version + tagPart )}. Continue?`;
      }
    }
  ];

  /* eslint-disable no-process-exit */
  return inquirer.prompt( prompts ).then( answers => {
    if ( answers.confirm ) {
      opts.version = answers.version || opts.version;
      opts.tag = answers.tag || opts.tag;
      opts.access = answers.access || opts.access;
    } else {
      process.exit( 0 );
    }
  } );
}
