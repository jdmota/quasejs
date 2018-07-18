import { validate, printError, t } from ".";

try {
  validate( {
    deprecated: t.object( {
      properties: {
        deprecated: true
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            bar: {
              type: "string",
              example: "example"
            }
          }
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            bar: {
              type: "string",
              example: "example"
            }
          }
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            bar: {
              type: "string",
              example: "example"
            }
          }
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.tuple( {
          items: [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ]
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.tuple( {
          items: [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ]
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.union( {
          types: [
            "string",
            "number"
          ],
          example: "example"
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.choices( {
          values: [
            0,
            1
          ],
          example: 1
        } )
      }
    } )
  }, {
    obj: {
      foo: 2
    }
  } );
} catch ( e ) {
  printError( e );
}

// yarn n packages/config/src/example
