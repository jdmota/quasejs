import { join } from "path";

/* eslint-disable @typescript-eslint/camelcase */

type O = {
  [key: string]: string | undefined;
};

export const defaultCheckersMap: O = {
  quase_builder_default_checker: join(__dirname, "checkers/default-checker"),
};

export const defaultCheckers = Object.keys(defaultCheckersMap);

export const defaultResolversMap: O = {
  quase_builder_js_resolver: join(__dirname, "resolvers/js-resolver"),
  quase_builder_default_resolver: join(__dirname, "resolvers/default-resolver"),
};

export const defaultResolvers = Object.keys(defaultResolversMap);

export const babelTransformer = "quase_builder_babel_transformer";
export const jsTransformer = "quase_builder_js_transformer";
export const htmlTransformer = "quase_builder_html_transformer";

export const defaultTransformersMap: O = {
  [babelTransformer]: join(__dirname, "transformers/babel-transformer"),
  [jsTransformer]: join(__dirname, "transformers/js-transformer"),
  [htmlTransformer]: join(__dirname, "transformers/html-transformer"),
};

export const defaultTransformers = Object.keys(defaultTransformersMap);

export const defaultPackagersMap: O = {
  quase_builder_js_packager: join(__dirname, "packagers/js-packager"),
  quase_builder_html_packager: join(__dirname, "packagers/html-packager"),
};

export const defaultPackagers = Object.keys(defaultPackagersMap);
