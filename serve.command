#!/bin/bash
# Double-click this file (or run ./serve.command) to launch SI Companion the
# RIGHT way: over http://localhost:8138 so it loads your .env API key and always
# serves the latest code (no-cache headers). Do NOT open index.html as file://.
cd "$(dirname "$0")"
PORT=8138
# Open the browser a moment after the server comes up.
( sleep 1; open "http://localhost:$PORT" ) &
echo "SI Companion is running at http://localhost:$PORT"
echo "Keep this window open. Press Ctrl+C to stop the server."
PORT=$PORT exec node -e "const http=require('http'),fs=require('fs'),path=require('path'),root=process.cwd(),port=process.env.PORT||8138;http.createServer((q,s)=>{let u=q.url.split('?')[0];if(u==='/')u='/index.html';let f=path.join(root,u);fs.readFile(f,(e,d)=>{s.setHeader('Cache-Control','no-store, no-cache, must-revalidate');if(e){s.statusCode=404;s.end('not found');}else{s.setHeader('content-type',u.endsWith('.html')?'text/html':'text/plain');s.end(d);}});}).listen(port,()=>console.log('serving on '+port));"
