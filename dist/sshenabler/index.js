"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// just a dummy http server to create a SSH tunnel to serve onpremise destinations.
const http_1 = __importDefault(require("http"));
const port = process.env.PORT || 3000;
const server = http_1.default.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Hi, I'm just a lazy service to enable local SSH tunnels.`);
});
server.listen(port, () => {
    console.log(`Server is running on port ${port}!`);
});
//# sourceMappingURL=index.js.map