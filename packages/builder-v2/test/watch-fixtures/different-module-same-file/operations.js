module.exports = [
  [ "writeFile", "./index.html", `<!DOCTYPE html>
  <html>
    <head></head>
    <body>
      <script type="module">
        import "./a.js";
      </script>
    </body>
  </html>` ]
];
