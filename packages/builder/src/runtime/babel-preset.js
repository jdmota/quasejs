import transformES2015TemplateLiterals from "@babel/plugin-transform-template-literals";
import transformES2015ArrowFunctions from "@babel/plugin-transform-arrow-functions";
import transformES2015BlockScoping from "@babel/plugin-transform-block-scoping";

export default () => {
  const loose = true;
  const spec = false;

  return {
    plugins: [
      [ transformES2015TemplateLiterals, { loose, spec } ],
      [ transformES2015ArrowFunctions, { spec } ],
      transformES2015BlockScoping
    ]
  };
};
