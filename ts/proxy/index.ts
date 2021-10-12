import http from "http";
import httpProxy from "http-proxy";
import pino from "pino";
import dotenv from "dotenv";
import { getDestination, retrieveJwt, Destination } from "@sap-cloud-sdk/core";
import * as xsenv from "@sap/xsenv";

import {
  IHTTPDestinationConfiguration,
  readDestination,
} from "sap-cf-destconn";
import {
  basicToJWT,
  getAuthenticationType
} from "./authentication";

type IAuthenticationType = "bearer" | "basic" | "none";
type IDestinationCache = {
  [destination: string]: {
    timeout: number;
    destination: Destination;
  };
};
//Load default-env.json file automatically from the beginning
xsenv.loadEnv();
dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  prettyPrint: process.env.LOG_AS_TEXT !== "false",
});

const proxy = httpProxy.createProxyServer({
  secure: false,
});

var destinationCache: IDestinationCache = {};

const config = {
  timeout: Number(process.env.TIMEOUT_DESTINATION) || 3600, // 3600 - 60 Minutes
  proxyport: process.env.PORT || 5050,
  defaultDestination: process.env.DEFAULT_DESTINATION || "SAP_ABAP_BACKEND",
  destinationPropertyName: (
    process.env.DESTINATION_PROPERTY_NAME || "X-SAP-BTP-destination"
  ).toLowerCase(),
  cfproxy: {
    host: process.env.CFPROXY_HOST || "127.0.0.1",
    port: parseInt(process.env.CFPROXY_PORT || "20003"),
  },
  credentials:
    process.env.USERNAME && process.env.PASSWORD
      ? {
          username: process.env.USERNAME,
          password: process.env.PASSWORD,
        }
      : undefined,
};

proxy.on("proxyReq", function (proxyReq, req, res, options) {
  //TODO: do we need another way to send the headers to this function?
  //@ts-ignore
  const newHeaders = options.target?.headers || {};

  Object.entries(newHeaders).forEach(function ([key, value]) {
    proxyReq.setHeader(key, <string>value);
  });
});

const server = http.createServer(async (req, res) => {
  const authorization = req.headers.authorization || "";
  const authenticationType = getAuthenticationType(authorization);

  let authorizationHeader;
  let jwtToken = {
    token_type: "",
    access_token: "",
  };
  if (authenticationType === "basic") {
    jwtToken = await basicToJWT(authorization);
    authorizationHeader = `${jwtToken.token_type} ${jwtToken.access_token}`;
  }
  if (authenticationType === "bearer") {
    jwtToken.token_type = "bearer";
    jwtToken.access_token = authorization.split(" ")[1];
    authorizationHeader = authorization;
  }
  if (authenticationType === "none" && config.credentials) {
    jwtToken = await basicToJWT(config.credentials);
    authorizationHeader = `${jwtToken.token_type} ${jwtToken.access_token}`;
  }

  // read the destination name
  const destinationName =
    [req.headers[config.destinationPropertyName]].flat()[0] ||
    config.defaultDestination;
  logger.info(`Request entered the building: proxy to ${destinationName}`);
  let sdkDestination;
  // read the destination on cloud foundry
  try {
    if (
      !destinationCache ||
      !destinationCache[destinationName] ||
      new Date().getTime() - config.timeout * 1000 >
        destinationCache[destinationName].timeout
    ) {
      const options = {
        userJwt: jwtToken.access_token,
      };
      sdkDestination = await getDestination(destinationName, options);
      if (sdkDestination === null) {
        throw Error(`Connection ${destinationName} not found`);
      }
      logger.info(`Cache destination ${destinationName}`);
      destinationCache[destinationName] = {
        destination: sdkDestination,
        timeout: new Date().getTime(),
      };
    }
    sdkDestination = destinationCache[destinationName].destination;

    logger.info(`Forwarding this request to ${sdkDestination.url}`);
    let target: any = new URL(sdkDestination.url);
    target.headers = {
      host: target.host,
    };

    //
    if (sdkDestination.authentication === "BasicAuthentication") {
      req.headers.authorization =
        "Basic " +
        Buffer.from(
          `${sdkDestination.username}:${sdkDestination.password}`,
          "ascii"
        ).toString("base64");
    }

    if (sdkDestination.authentication === "OAuth2ClientCredentials") {
      if (!sdkDestination.authTokens) {
        throw new Error(
          `No token retrieved for destination ${destinationName}`
        );
      }
      const clientCredentialsToken = sdkDestination.authTokens[0].value;
      target.headers = {
        ...target.headers,
        Authorization: `Bearer ${clientCredentialsToken}`,
      };
      delete req.headers.authorization;
    }

    if (
      sdkDestination.authTokens &&
      sdkDestination.authTokens[0] &&
      !sdkDestination.authTokens[0].error
    ) {
      if (sdkDestination.authTokens[0].error) {
        throw new Error(sdkDestination.authTokens[0].error);
      }
      target.headers = {
        ...target.headers,
        Authorization: `${sdkDestination.authTokens[0].type} ${sdkDestination.authTokens[0].value}`,
      };
      delete req.headers.authorization;
    }
    //

    if (sdkDestination.proxyType!.toLowerCase() === "onpremise") {
      logger.info(
        `This is an on premise request. Let's send it over the SSH tunnel.`
      );

      target = {
        headers: {
          ...target.headers,
        },
        protocol: sdkDestination.proxyConfiguration!.protocol,
        host: config.cfproxy.host,
        port: config.cfproxy.port,
      };
      if (sdkDestination.cloudConnectorLocationId) {
        target.headers["SAP-Connectivity-SCC-Location_ID"] =
          sdkDestination.cloudConnectorLocationId;
      }

      if (sdkDestination.proxyConfiguration) {
        req.headers = {
          ...req.headers,
          ...sdkDestination.proxyConfiguration!.headers,
        };
      }

      if (sdkDestination.authentication === "PrincipalPropagation") {
        req.headers["SAP-Connectivity-Authentication"] = authorizationHeader;
        delete req.headers.authorization;
      }
    }

    proxy.web(req, res, { target });
  } catch (error) {
    logger.error(JSON.stringify(error));
  }
});

logger.info(`proxy listening on port     : ${config.proxyport}`);
server.listen(config.proxyport);
