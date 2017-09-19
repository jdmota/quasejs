const separator = ", ";
const dataVar = "config";

export function errorsText( errors ) {
  let text = "";
  for ( let i = 0; i < errors.length; i++ ) {
    const e = errors[ i ];
    if ( e.keyword === "additionalProperties" ) {
      text += `${dataVar}${e.dataPath} has an unknown property '${e.params.additionalProperty}'.`;
    } else {
      text += dataVar + e.dataPath + " " + e.message + separator;
    }
  }
  return text.slice( 0, -separator.length );
}

export default {
  additionalProperties: false,
  properties: {

    cwd: {
      description: "The base directory for resolving entries.",
      type: "string"
    },

    cli: {
      codeFrame: {
        highlightCode: {
          description: "Toggles syntax highlighting the code as JavaScript for terminals.",
          type: "boolean"
        },
        linesAbove: {
          description: "Adjust the number of lines to show above the error.",
          type: "number"
        },
        linesBelow: {
          description: "Adjust the number of lines to show below the error.",
          type: "number"
        },
        forceColor: {
          description: "Enable this to forcibly syntax highlight the code as JavaScript (for non-terminals); overrides highlightCode.",
          type: "boolean"
        }
      },
      type: "object"
    },

    resolve: {
      type: "object"
    },

    sourceMaps: {
      oneOf: [
        {
          description: "`true`: build source maps.",
          type: "boolean"
        },
        {
          description: "`inline`: inline the source maps.",
          pattern: "^inline$",
          type: "string"
        }
      ]
    },

    watch: {
      description: "Enter watch mode, which rebuilds on file change.",
      type: "boolean"
    },

    watchOptions: {
      properties: {
        aggregateTimeout: {
          description: "Delay the rebuilt after the first change. Value is a time in ms.",
          type: "number"
        },
        poll: {
          oneOf: [
            {
              description: "`true`: use polling.",
              type: "boolean"
            },
            {
              description: "`number`: use polling with specified interval.",
              type: "number"
            }
          ]
        },
        ignored: {
          description: "anymatch-compatible definition of files/paths to be ignored."
        }
      },
      type: "object"
    },

    plugins: {
      description: "Plugins.",
      type: "array"
    },

    builds: {
      items: {
        target: {
          type: "string",
          pattern: "^((web|node(js)?|sw)\\|)+$"
        },
        entries: {
          items: {
            type: "string"
          },
          type: "array"
        },
        type: "object"
      },
      type: "array"
    }

  },

  required: [
    "builds"
  ],

  type: "object"
};
