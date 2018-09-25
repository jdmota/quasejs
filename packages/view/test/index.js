import babelPlugin from "../src/compiler";

const babel = require( "@babel/core" );
const jsdom = require( "jsdom" );
const { JSDOM } = jsdom;

const fixtures = [
  `
  render = function render({text}) {
    return <div
      someProp={1}
      a-nother={2}
      multiParts={\`\${3} \${4}\`}
      a={5}
      a$={6}>
      <p>{7}</p>
      <div aThing={8}>{[9,<span>{10}</span>,11]}</div>
      <><i>Italic: {text}</i></>
    </div>;
  };
  `,
  `
  // Fragment at root
  render = function render({text}) {
    return <><i>Italic: {text}</i></>;
  };
  `
];

describe( "compile and runtime", () => {

  let i = 0;

  for ( const code of fixtures ) {
    it( `test ${i++}`, () => {

      const finalCode = babel.transformSync( code, {
        plugins: [ babelPlugin ],
        babelrc: false,
        configFile: false,
        sourceMaps: false,
        generatorOpts: {
          retainLines: true
        }
      } ).code;

      expect( finalCode ).toMatchSnapshot();

      const dom = new JSDOM( `<!DOCTYPE html><div id="container"></div>` );
      const container = dom.window.document.getElementById( "container" );
      const QuaseView = require( "../src/runtime" )( dom.window );

      let render;
      eval( finalCode ); // eslint-disable-line no-eval
      QuaseView.render( render( { text: "text" } ), container );

      expect( container.innerHTML ).toMatchSnapshot();

    } );
  }

} );
