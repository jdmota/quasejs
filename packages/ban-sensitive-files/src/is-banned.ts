import { Rule, Banned, PART_VALUES, TYPE_VALUES } from "./types";

const path = require( "path" );
const anyRules = require( "./git-deny-patterns.json" );

function assertErr() {
  return new Error( `Assertion error` );
}

function validateJsonRules( anyRules: unknown ): Rule[] {
  if ( !Array.isArray( anyRules ) ) throw assertErr();

  const rules: Rule[] = [];

  for ( const anyRule of anyRules ) {
    if ( typeof anyRule !== "object" || anyRule == null ) throw assertErr();
    if ( !PART_VALUES.includes( anyRule.part ) ) throw assertErr();
    if ( !TYPE_VALUES.includes( anyRule.type ) ) throw assertErr();
    if ( typeof anyRule.pattern !== "string" ) throw assertErr();
    if ( typeof anyRule.caption !== "string" ) throw assertErr();
    if ( typeof anyRule.description !== "string" && anyRule.description !== null ) throw assertErr();
    rules.push( anyRule );
  }

  return rules;
}

const rules = validateJsonRules( anyRules );

function toR( pattern: string ) {
  const jsPattern = pattern.replace( "\\A", "^" ).replace( "\\z", "$" );
  return new RegExp( jsPattern );
}

function extension( filename: string ) {
  // Remove leading dot
  return path.extname( filename ).substr( 1 );
}

const fileParts = {
  filename: path.basename as ( x: string ) => string,
  path: ( x: string ) => x,
  extension
};

const regRules = {
  regex( pattern: string ) {
    const reg = toR( pattern );
    return ( str: string ) => reg.test( str );
  },
  match( pattern: string ) {
    return ( str: string ) => str === pattern;
  }
};

function ruleToTester( rule: Rule ) {
  const getFilePart = fileParts[ rule.part ];
  const getRegex = regRules[ rule.type ];
  const getRegexFull = getRegex( rule.pattern );

  return ( str: string ) => {
    const part = getFilePart( str );
    return getRegexFull( part );
  };
}

const testers = rules.map( rule => ( { rule, tester: ruleToTester( rule ) } ) );

export default function( filenames: string[] ) {
  const banned: Banned[] = [];
  for ( const filename of filenames ) {
    const b: Banned = {
      filename,
      rules: []
    };
    for ( const { rule, tester } of testers ) {
      if ( tester( filename ) ) {
        b.rules.push( rule );
      }
    }
    if ( b.rules.length > 0 ) {
      banned.push( b );
    }
  }
  return banned;
}
