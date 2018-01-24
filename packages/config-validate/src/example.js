import { validate, printError, t } from ".";

try {
  validate( {
    deprecated: {
      deprecated: true
    }
  }, {
    deprecated: true
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    config: {
      type: "string"
    }
  }, {
    config: true
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            bar: {
              type: "string",
              example: "example"
            }
          } )
        }
      } )
    }
  }, {
    obj: {
      foo: {
        bar: 10
      }
    }
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            bar: {
              type: "string",
              example: "example"
            }
          } )
        }
      } )
    }
  }, {
    obj: {
      foo: 10
    }
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            bar: {
              type: "string",
              example: "example"
            }
          } )
        }
      } )
    }
  }, {
    obj: {
      foo: {
        baz: "abc"
      }
    }
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    obj: {
      type: t.object( {
        foo: {
          type: t.tuple( [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ] )
        }
      } )
    }
  }, {
    obj: {
      foo: [ "string", 10 ]
    }
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    obj: {
      type: t.object( {
        foo: {
          type: t.tuple( [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ] )
        }
      } )
    }
  }, {
    obj: {
      foo: {}
    }
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    obj: {
      type: t.object( {
        foo: {
          type: t.union( [
            "string",
            "number"
          ] ),
          example: "example"
        }
      } )
    }
  }, {
    obj: {
      foo: [ "string", 10 ]
    }
  } );
} catch ( e ) {
  printError( e );
}

try {
  validate( {
    obj: {
      type: t.object( {
        foo: {
          choices: [
            0,
            1
          ],
          example: 1
        }
      } )
    }
  }, {
    obj: {
      foo: 2
    }
  } );
} catch ( e ) {
  printError( e );
}

// yarn node packages/config-validate/src/example
