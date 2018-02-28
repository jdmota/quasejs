module.exports = function( arg ) {
  return Promise.resolve( {
    arg,
    fromFunction: "yes"
  } );
};
