module.exports = {
  env: {
    node: true,
    browser: true,
    es6: true,
  },
  extends: [
    "plugin:import/recommended",
    "plugin:node/recommended",
    "eslint:recommended",
    "prettier",
  ],
  plugins: ["import", "node"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  rules: {
    "accessor-pairs": "error",
    "array-bracket-spacing": ["error", "always"],
    "arrow-parens": ["error", "as-needed"],
    "arrow-spacing": [
      "error",
      {
        after: true,
        before: true,
      },
    ],
    "block-scoped-var": "error",
    "block-spacing": ["error", "always"],
    "brace-style": [
      "error",
      "1tbs",
      {
        allowSingleLine: true,
      },
    ],
    camelcase: [
      "error",
      {
        properties: "never",
      },
    ],
    "capitalized-comments": [
      "off",
      "never",
      {
        block: {
          ignoreConsecutiveComments: true,
          ignoreInlineComments: true,
          ignorePattern: ".*",
        },
        line: {
          ignoreConsecutiveComments: true,
          ignoreInlineComments: true,
          ignorePattern: ".*",
        },
      },
    ],
    "comma-spacing": [
      "error",
      {
        after: true,
        before: false,
      },
    ],
    "comma-style": ["error", "last"],
    complexity: ["off", 11],
    "computed-property-spacing": ["error", "always"],
    curly: ["error", "multi-line"],
    "default-case": [
      "error",
      {
        commentPattern: "^no default$",
      },
    ],
    "dot-location": ["error", "property"],
    "dot-notation": [
      "error",
      {
        allowKeywords: true,
      },
    ],
    "eol-last": ["error", "always"],
    eqeqeq: [
      "error",
      "always",
      {
        null: "ignore",
      },
    ],
    "func-call-spacing": ["error", "never"],
    "func-name-matching": [
      "off",
      "always",
      {
        includeCommonJSModuleExports: false,
      },
    ],
    "func-style": ["off", "expression"],
    "generator-star-spacing": [
      "error",
      {
        after: true,
        before: false,
      },
    ],
    "handle-callback-err": "warn",
    "import/unambiguous": "off",
    indent: [
      2,
      2,
      {
        SwitchCase: 1,
        VariableDeclarator: 2,
      },
    ],
    "jsx-quotes": ["off", "prefer-double"],
    "key-spacing": [
      "error",
      {
        afterColon: true,
        beforeColon: false,
      },
    ],
    "keyword-spacing": [
      "error",
      {
        after: true,
        before: true,
        overrides: {
          case: {
            after: true,
          },
          return: {
            after: true,
          },
          throw: {
            after: true,
          },
        },
      },
    ],
    "line-comment-position": [
      "off",
      {
        applyDefaultPatterns: true,
        ignorePattern: "",
        position: "above",
      },
    ],
    "linebreak-style": ["error", "unix"],
    "lines-around-directive": [
      "error",
      {
        after: "always",
        before: "always",
      },
    ],
    "max-depth": ["off", 4],
    "max-lines": [
      "off",
      {
        max: 300,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    "max-params": ["off", 3],
    "max-statements": ["off", 10],
    "max-statements-per-line": [
      "off",
      {
        max: 1,
      },
    ],
    "multiline-ternary": ["off", "never"],
    "new-cap": [
      "error",
      {
        capIsNew: false,
        capIsNewExceptions: [
          "Immutable.Map",
          "Immutable.Set",
          "Immutable.List",
        ],
        newIsCap: true,
        newIsCapExceptions: [],
      },
    ],
    "new-parens": "error",
    "no-alert": "warn",
    "no-array-constructor": "error",
    "no-await-in-loop": "off",
    "no-caller": "error",
    "no-class-assign": "error",
    "no-cond-assign": "off",
    "no-confusing-arrow": [
      "error",
      {
        allowParens: true,
      },
    ],
    "no-console": "warn",
    "no-constant-condition": [
      "error",
      {
        checkLoops: false,
      },
    ],
    "no-else-return": "error",
    "no-empty-function": [
      "error",
      {
        allow: ["arrowFunctions", "functions", "methods"],
      },
    ],
    "no-eval": "error",
    "no-extra-bind": "error",
    "no-extra-label": "error",
    "no-extra-parens": [
      "off",
      "all",
      {
        conditionalAssign: true,
        nestedBinaryExpressions: false,
        returnAssign: false,
      },
    ],
    "no-floating-decimal": "error",
    "no-global-assign": [
      "error",
      {
        exceptions: [],
      },
    ],
    "no-implicit-coercion": [
      "off",
      {
        allow: [],
        boolean: false,
        number: true,
        string: true,
      },
    ],
    "no-implied-eval": "error",
    "no-iterator": "error",
    "no-label-var": "error",
    "no-labels": [
      "error",
      {
        allowLoop: false,
        allowSwitch: false,
      },
    ],
    "no-lone-blocks": "error",
    "no-loop-func": "off",
    "no-magic-numbers": [
      "off",
      {
        detectObjects: false,
        enforceConst: true,
        ignore: [],
        ignoreArrayIndexes: true,
      },
    ],
    "no-mixed-operators": [
      "error",
      {
        allowSamePrecedence: true,
        groups: [
          ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
          ["&&", "||"],
          ["in", "instanceof"],
        ],
      },
    ],
    "no-mixed-requires": ["off", false],
    "no-multi-spaces": "error",
    "no-multi-str": "error",
    "no-multiple-empty-lines": [
      "error",
      {
        max: 2,
        maxEOF: 1,
      },
    ],
    "no-new": "error",
    "no-new-func": "error",
    "no-new-object": "error",
    "no-new-require": "error",
    "no-new-symbol": "error",
    "no-new-wrappers": "error",
    "no-obj-calls": "error",
    "no-octal-escape": "error",
    "no-path-concat": "error",
    "no-proto": "error",
    "no-prototype-builtins": "error",
    "no-regex-spaces": "error",
    "no-restricted-properties": [
      "error",
      {
        message: "arguments.callee is deprecated",
        object: "arguments",
        property: "callee",
      },
      {
        message: "Please use Object.defineProperty instead.",
        property: "__defineGetter__",
      },
      {
        message: "Please use Object.defineProperty instead.",
        property: "__defineSetter__",
      },
      {
        message: "Use the exponentiation operator (**) instead.",
        object: "Math",
        property: "pow",
      },
    ],
    "no-restricted-syntax": ["error", "WithStatement"],
    "no-return-assign": "error",
    "no-return-await": "error",
    "no-script-url": "error",
    "no-self-compare": "error",
    "no-sequences": "error",
    "no-shadow-restricted-names": "error",
    "no-spaced-func": "error",
    "no-tabs": "error",
    "no-template-curly-in-string": "error",
    "no-throw-literal": "error",
    "no-trailing-spaces": "error",
    "no-undef": [
      "error",
      {
        typeof: false,
      },
    ],
    "no-undef-init": "error",
    "no-unneeded-ternary": [
      "error",
      {
        defaultAssignment: false,
      },
    ],
    "no-unused-expressions": [
      "error",
      {
        allowShortCircuit: false,
        allowTernary: false,
      },
    ],
    "no-unused-vars": [
      "error",
      {
        args: "after-used",
        argsIgnorePattern: "^_",
        ignoreRestSiblings: true,
        vars: "local",
      },
    ],
    "no-use-before-define": [
      "error",
      {
        classes: false,
        functions: false,
      },
    ],
    "no-useless-call": "error",
    "no-useless-computed-key": "error",
    "no-useless-concat": "error",
    "no-useless-constructor": "error",
    "no-useless-rename": [
      "error",
      {
        ignoreDestructuring: false,
        ignoreExport: false,
        ignoreImport: false,
      },
    ],
    "no-useless-return": "error",
    "no-var": "error",
    "no-void": "error",
    "no-warning-comments": "warn",
    "no-whitespace-before-property": "error",
    "no-with": "error",
    "node/no-unpublished-require": "off",
    "node/no-unsupported-features/es-builtins": "off",
    "node/no-unsupported-features/es-syntax": "off",
    "object-curly-newline": [
      "off",
      {
        ObjectExpression: {
          minProperties: 0,
          multiline: true,
        },
        ObjectPattern: {
          minProperties: 0,
          multiline: true,
        },
      },
    ],
    "object-curly-spacing": ["error", "always"],
    "object-property-newline": [
      "error",
      {
        allowMultiplePropertiesPerLine: true,
      },
    ],
    "operator-assignment": ["error", "always"],
    "prefer-destructuring": [
      "off",
      {
        array: true,
        object: true,
      },
      {
        enforceForRenamedProperties: false,
      },
    ],
    "prefer-numeric-literals": "error",
    "prefer-promise-reject-errors": [
      "off",
      {
        allowEmptyReject: true,
      },
    ],
    "quote-props": [
      "error",
      "as-needed",
      {
        keywords: false,
        numbers: false,
        unnecessary: true,
      },
    ],
    quotes: [
      "error",
      "double",
      {
        allowTemplateLiterals: true,
        avoidEscape: true,
      },
    ],
    radix: "error",
    "rest-spread-spacing": ["error", "never"],
    semi: ["error", "always"],
    "semi-spacing": [
      "error",
      {
        after: true,
        before: false,
      },
    ],
    "sort-imports": [
      "off",
      {
        ignoreCase: false,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
      },
    ],
    "sort-keys": [
      "off",
      "asc",
      {
        caseSensitive: false,
        natural: true,
      },
    ],
    "space-before-blocks": "error",
    "space-before-function-paren": ["error", "never"],
    "space-in-parens": ["error", "always"],
    "space-infix-ops": "error",
    "space-unary-ops": [
      "error",
      {
        nonwords: false,
        overrides: {},
        words: true,
      },
    ],
    "spaced-comment": [
      "error",
      "always",
      {
        markers: ["!"],
      },
    ],
    strict: "error",
    "template-curly-spacing": "error",
    "template-tag-spacing": ["off", "never"],
    "unicode-bom": ["error", "never"],
    "valid-typeof": [
      "error",
      {
        requireStringLiterals: true,
      },
    ],
    "vars-on-top": "error",
    "wrap-iife": ["error", "inside"],
    "yield-star-spacing": ["error", "after"],
    yoda: [
      2,
      "never",
      {
        exceptRange: true,
      },
    ],
  },
  overrides: [
    {
      env: {
        jest: true,
      },
      files: ["**/test/**/*.js", "**/test/**/*.ts"],
      plugins: ["jest"],
      rules: {
        "jest/no-focused-tests": "error",
        "jest/prefer-to-have-length": "error",
        "jest/valid-describe": "error",
        "jest/valid-expect": "error",
        "spaced-comment": "off",
      },
    },
    {
      files: ["*.js"],
      settings: {
        "import/resolver": {
          node: {
            extensions: [".js", ".ts"],
          },
        },
      },
    },
    {
      files: ["*.ts"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
      },
      rules: {
        "import/extensions": [0, "never", { ts: "never" }],
        "@typescript-eslint/adjacent-overload-signatures": "error",
        "@typescript-eslint/array-type": "error",
        "@typescript-eslint/ban-types": "error",
        camelcase: "off",
        "@typescript-eslint/camelcase": "error",
        "@typescript-eslint/consistent-type-definitions": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-member-accessibility": "off",
        indent: "off",
        "@typescript-eslint/indent": ["error", 2],
        "@typescript-eslint/member-delimiter-style": "error",
        "no-array-constructor": "off",
        "@typescript-eslint/no-array-constructor": "error",
        "@typescript-eslint/no-empty-interface": "error",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-inferrable-types": "error",
        "@typescript-eslint/no-misused-new": "error",
        "@typescript-eslint/no-namespace": "error",
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/no-parameter-properties": "error",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            args: "after-used",
            argsIgnorePattern: "^_",
            ignoreRestSiblings: true,
            vars: "local",
          },
        ],
        "@typescript-eslint/no-use-before-define": [
          "error",
          {
            classes: false,
            functions: false,
            typedefs: false,
          },
        ],
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/type-annotation-spacing": "error",
      },
      settings: {
        "import/resolver": {
          node: true,
          "eslint-import-resolver-typescript": true,
        },
      },
    },
  ],
};
