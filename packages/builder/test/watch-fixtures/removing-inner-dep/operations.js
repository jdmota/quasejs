module.exports = [
  [
    "writeFile",
    "./index.html",
    `
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <script type="module">
          console.log("a");
        </script>
      </body>
    </html>
    `
  ],
  [
    "writeFile",
    "./index.html",
    `
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
      </body>
    </html>
    `
  ]
];
