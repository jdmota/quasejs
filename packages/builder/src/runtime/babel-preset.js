import transformES2015TemplateLiterals from "@babel/plugin-transform-template-literals";
import transformES2015ArrowFunctions from "@babel/plugin-transform-arrow-functions";
import transformES2015BlockScopedFunctions from "@babel/plugin-transform-block-scoped-functions";
import transformES2015ShorthandProperties from "@babel/plugin-transform-shorthand-properties";
import transformES2015Parameters from "@babel/plugin-transform-parameters";
import transformES2015Destructuring from "@babel/plugin-transform-destructuring";
import transformES2015BlockScoping from "@babel/plugin-transform-block-scoping";

export default () => {
  const loose = true;
  const spec = false;
  const optsLoose = { loose };

  return {
    plugins: [
      [ transformES2015TemplateLiterals, { loose, spec } ],
      [ transformES2015ArrowFunctions, { spec } ],
      transformES2015BlockScopedFunctions,
      transformES2015ShorthandProperties,
      [ transformES2015Parameters, optsLoose ],
      [ transformES2015Destructuring, optsLoose ],
      transformES2015BlockScoping
    ]
  };
};
