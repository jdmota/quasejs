import( "./foo" ).then();

function foo( n ) {
  import( `./foo-${n}` ).then();
}
