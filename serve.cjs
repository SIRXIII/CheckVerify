const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;
const dist = path.join(__dirname, 'dist');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json' };
http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  let file = path.join(dist, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving on http://localhost:${port}`));
