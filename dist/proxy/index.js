"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const http_proxy_1 = __importDefault(require("http-proxy"));
const pino_1 = __importDefault(require("pino"));
const dotenv_1 = __importDefault(require("dotenv"));
const core_1 = require("@sap-cloud-sdk/core");
const sap_cf_destconn_1 = require("sap-cf-destconn");
const authentication_1 = require("./authentication");
dotenv_1.default.config();
const logger = pino_1.default({
    level: process.env.LOG_LEVEL || "info",
    prettyPrint: process.env.LOG_AS_TEXT !== "false",
});
const proxy = http_proxy_1.default.createProxyServer({
    secure: false,
});
const config = {
    proxyport: process.env.PORT || 5050,
    defaultDestination: process.env.DEFAULT_DESTINATION || "SAP_ABAP_BACKEND",
    destinationPropertyName: (process.env.DESTINATION_PROPERTY_NAME || "X-SAP-BTP-destination").toLowerCase(),
    cfproxy: {
        host: process.env.CFPROXY_HOST || '127.0.0.1',
        port: parseInt(process.env.CFPROXY_PORT || "20003")
    },
    credentials: process.env.USER && process.env.PASSWORD ? {
        username: process.env.USER,
        password: process.env.PASSWORD
    } : undefined
};
proxy.on("proxyReq", function (proxyReq, req, res, options) {
    var _a;
    //TODO: do we need another way to send the headers to this function?
    //@ts-ignore
    const newHeaders = ((_a = options.target) === null || _a === void 0 ? void 0 : _a.headers) || {};
    Object.entries(newHeaders).forEach(function ([key, value]) {
        proxyReq.setHeader(key, value);
    });
});
const server = http_1.default.createServer(async (req, res) => {
    const authorization = req.headers.authorization || "";
    const authenticationType = authentication_1.getAuthenticationType(authorization);
    let authorizationHeader;
    if (authenticationType === "basic") {
        authorizationHeader = await authentication_1.basicToJWT(authorization);
    }
    if (authenticationType === "bearer") {
        authorizationHeader = authorization;
    }
    if (authenticationType === "none" && config.credentials) {
        authorizationHeader = await authentication_1.basicToJWT(config.credentials);
    }
    // read the destination name
    const destinationName = [req.headers[config.destinationPropertyName]].flat()[0] || config.defaultDestination;
    logger.info(`Request entered the building: proxy to ${destinationName}`);
    // read the destination on cloud foundry
    try {
        const sdkDestination = await core_1.getDestination(destinationName);
        const destination = await sap_cf_destconn_1.readDestination(destinationName, authorizationHeader);
        const destinationConfiguration = destination.destinationConfiguration;
        logger.info(`Forwarding this request to ${destinationConfiguration.URL}`);
        let target = new URL(destinationConfiguration.URL);
        target.headers = {
            'host': target.host
        };
        //
        if (destinationConfiguration.Authentication === "OAuth2ClientCredentials") {
            const clientCredentialsToken = await authentication_1.createTokenForDestination(destinationConfiguration);
            target.headers = {
                ...target.headers,
                Authorization: `Bearer ${clientCredentialsToken}`
            };
            delete req.headers.authorization;
        }
        if (destination.authTokens && destination.authTokens[0] && !destination.authTokens[0].error) {
            if (destination.authTokens[0].error) {
                throw (new Error(destination.authTokens[0].error));
            }
            target.headers = {
                ...target.headers,
                Authorization: `${destination.authTokens[0].type} ${destination.authTokens[0].value}`
            };
            delete req.headers.authorization;
        }
        //
        if (destination.destinationConfiguration.ProxyType.toLowerCase() === "onpremise") {
            logger.info(`This is an on premise request. Let's send it over the SSH tunnel.`);
            const proxy = await (destinationConfiguration.Authentication === "PrincipalPropagation" ?
                sap_cf_destconn_1.readConnectivity(destination.destinationConfiguration.CloudConnectorLocationId, authorizationHeader) :
                sap_cf_destconn_1.readConnectivity(destination.destinationConfiguration.CloudConnectorLocationId));
            target = {
                path: `${destination.destinationConfiguration.URL}${req.url}`,
                headers: {
                    ...target.headers,
                    ...proxy.headers
                },
                protocol: proxy.proxy.protocol,
                host: config.cfproxy.host,
                port: config.cfproxy.port
            };
            if (destinationConfiguration.Authentication === "PrincipalPropagation") {
                delete req.headers.authorization;
            }
        }
        proxy.web(req, res, { target });
    }
    catch (error) {
        logger.error(error);
    }
});
logger.info(`proxy listening on port     : ${config.proxyport}`);
server.listen(config.proxyport);
//# sourceMappingURL=index.js.map