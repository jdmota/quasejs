import { babelPlugin } from "../src/compiler";

const babel = require( "@babel/core" );
const jsdom = require( "jsdom" );
const { JSDOM } = jsdom;

const fixtures = [
  `
  render = function render() {
    return html\`
    <div
      someProp="\${1}"
      a-nother="\${2}"
      multiParts='\${3} \${4}'
      👍=\${5}
      (a)=\${6}
      [a]=\${7}
      a$=\${8}>
      <p>\${9}</p>
      <div aThing="\${10}">\${[1,html\`<span>\${2}</span>\`,3]}</div>
    </div>\`
  };
  `
];

describe( "compile and runtime", () => {

  let i = 0;

  for ( const code of fixtures ) {
    it( `test ${i++}`, () => {

      const finalCode = babel.transform( code, {
        plugins: [ babelPlugin ],
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
      QuaseView.render( render(), container );

      expect( container.innerHTML ).toMatchSnapshot();

    } );
  }

} );
