// Adapted from https://github.com/rollup/rollup/blob/master/src/ast/utils/extractNames.js
// Ref https://github.com/estree/estree/

const extractors: any = {
  Identifier(names: string[], param: any) {
    names.push(param.name);
  },

  ObjectPattern(names: string[], param: any) {
    param.properties.forEach((prop: any) => {
      extractors[prop.value.type](names, prop.value);
    });
  },

  ArrayPattern(names: string[], param: any) {
    param.elements.forEach((element: any) => {
      if (element) {
        extractors[element.type](names, element);
      }
    });
  },

  RestElement(names: string[], param: any) {
    extractors[param.argument.type](names, param.argument);
  },

  AssignmentPattern(names: string[], param: any) {
    extractors[param.left.type](names, param.left);
  },

  FunctionDeclaration(names: string[], param: any) {
    extractors[param.id.type](names, param.id);
  },

  VariableDeclaration(names: string[], param: any) {
    param.declarations.forEach((decl: any) => {
      extractors[decl.id.type](names, decl.id);
    });
  },
};

export default function extractNames(param: any) {
  const names: string[] = [];
  if (param) {
    extractors[param.type](names, param);
  }
  return names;
}
