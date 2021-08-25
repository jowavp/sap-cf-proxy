// just a dummy http server to create a SSH tunnel to serve onpremise destinations.
import http from "http";

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end(`Hi, I'm just a lazy service to enable local SSH tunnels.`);
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}!`);
});
