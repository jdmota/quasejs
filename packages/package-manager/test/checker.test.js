import { Checker } from "../src/commands/check";
import { CheckReporterNoop } from "../src/reporters/check";

const path = require( "path" );
const checkReporter = new CheckReporterNoop();

it( "duplicate dependencies in package.json", async() => {

  await expect(
    new Checker( checkReporter ).check( path.resolve( __dirname, "test-folders/duplicate-dep" ) )
  ).rejects.toThrowErrorMatchingSnapshot();

} );

it( "dependency on itself in package.json", async() => {

  await expect(
    new Checker( checkReporter ).check( path.resolve( __dirname, "test-folders/depend-on-itself" ) )
  ).rejects.toThrowErrorMatchingSnapshot();

} );
