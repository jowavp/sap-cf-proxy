"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticationType = exports.createTokenForDestination = exports.basicToJWT = void 0;
const xsenv = __importStar(require("@sap/xsenv"));
const axios_1 = __importDefault(require("axios"));
const config = {
    timeout: Number(process.env.TIMEOUT_JWT) || 3600, // 3600 - 60 Minutes
};
var jwtTokenCache = {};
const basicToJWT = async (authorization) => {
    xsenv.loadEnv();
    // check if a xsuaa is linked to this project.
    const { xsuaa } = xsenv.getServices({
        xsuaa: {
            tag: 'xsuaa'
        }
    });
    if (!xsuaa) {
        throw `No xsuaa service found`;
    }
    if ("string" === typeof authorization) {
        authorization = decodeBA(authorization);
    }
    let jwtToken;
    if (!jwtTokenCache ||
        !jwtTokenCache[authorization.username] ||
        new Date().getTime() - config.timeout * 1000 > jwtTokenCache[authorization.username].timeout) {
        jwtToken = await fetchToken(xsuaa, authorization);
        jwtTokenCache[authorization.username] = {
            jwtToken: jwtToken,
            timeout: new Date().getTime()
        };
    }
    jwtToken = jwtTokenCache[authorization.username].jwtToken;
    return `${jwtToken.token_type} ${jwtToken.access_token}`;
};
exports.basicToJWT = basicToJWT;
async function createTokenForDestination(dc) {
    const scope = convertScope(dc.Scope || dc.scope);
    const audience = dc.oauth_audience;
    let token;
    if (scope || audience) {
        token = (await axios_1.default({
            url: `${dc.tokenServiceURL}`,
            method: 'POST',
            responseType: 'json',
            data: {
                "grant_type": "client_credentials",
                scope,
                audience
            },
            headers: { 'Content-Type': 'application/json' },
            auth: {
                username: dc.clientId,
                password: dc.clientSecret
            }
        })).data;
    }
    else {
        token = (await axios_1.default({
            url: `${dc.tokenServiceURL}`,
            method: 'POST',
            responseType: 'json',
            data: `client_id=${encodeURIComponent(dc.clientId)}&client_secret=${encodeURIComponent(dc.clientSecret)}&grant_type=client_credentials`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: {
                username: dc.clientId,
                password: dc.clientSecret
            }
        })).data;
    }
    return token.access_token;
}
exports.createTokenForDestination = createTokenForDestination;
;
function convertScope(scope) {
    if (!scope)
        return null;
    return scope.split(" ").map((sc) => sc.split(':')).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {});
}
const getAuthenticationType = (authorization) => {
    return /bearer/igm.test(authorization) ? "bearer" : /basic/igm.test(authorization) ? "basic" : "none";
};
exports.getAuthenticationType = getAuthenticationType;
async function fetchToken(xsuaa, credentials) {
    const tokenBaseUrl = `${xsuaa.url}`;
    const token = (await axios_1.default({
        url: `${tokenBaseUrl}/oauth/token`,
        method: 'POST',
        responseType: 'json',
        data: `client_id=${encodeURIComponent(xsuaa.clientid)}&grant_type=password&response_type=token&username=${encodeURIComponent(credentials.username)}&password=${encodeURIComponent(credentials.password)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
            username: xsuaa.clientid,
            password: xsuaa.clientsecret
        }
    })).data;
    return token;
}
function decodeBA(authorization) {
    const [type, userpwd] = authorization.split(" "); // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part
    const buf = Buffer.from(userpwd, "base64"); // create a buffer and tell it the data coming in is base64
    const [username, password] = buf.toString().split(":");
    return {
        username,
        password
    };
}
//# sourceMappingURL=authentication.js.map