
import * as xsenv from '@sap/xsenv';
import axios from 'axios';
import { IHTTPDestinationConfiguration } from 'sap-cf-destconn';

type IXSUAA = {
    apiurl: string;
    clientid: string;
    clientsecret: string;
    identityzone: string;
    identityzoneid: string;
    sburl: string;
    subaccountid: string;
    tenantid: string;
    tenantmode: string;
    uaadomain: string;
    url: string;
    verificationkey: string;
    xsappname: string;
    zoneid: string;
}

type ICredentials = {
    username: string;
    password: string;
}

export const basicToJWT = async (authorization: string | ICredentials) => {
    
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
    const jwtToken = await fetchToken(xsuaa, authorization);

    return `${jwtToken.token_type} ${jwtToken.access_token}`;

}


export async function createTokenForDestination(dc: IHTTPDestinationConfiguration): Promise<string> {
    const scope = convertScope(dc.Scope || dc.scope);
    const audience = dc.oauth_audience;
    let token;

    if(scope || audience){
        token = (await axios({
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
    } else {
        token = (await axios({
            url: `${dc.tokenServiceURL}`,
            method: 'POST',
            responseType: 'json',
            data: `client_id=${encodeURIComponent(dc.clientId)}&client_secret=${encodeURIComponent(dc.clientSecret)}&grant_type=client_credentials`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            auth: {
                username: dc.clientId,
                password: dc.clientSecret
            }
        })).data
    }

    return token.access_token;
};


function convertScope (scope?: String) {
    if(!scope) return null;
    return scope.split(" ").map<string[]>(
        (sc) => sc.split(':')
    ).reduce<{[key: string]: string}>(
        (acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {}
    )

}

export const getAuthenticationType = (authorization: string) => {
    return /bearer/igm.test(authorization) ? "bearer" : /basic/igm.test(authorization) ? "basic" : "none";
}

async function fetchToken(xsuaa: IXSUAA, credentials: ICredentials) {
    const tokenBaseUrl = `${xsuaa.url}`;
    const token = (await axios({
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

function decodeBA(authorization: string) {
    const [type, userpwd] = authorization.split(" "); // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part

    const buf = Buffer.from(userpwd, "base64"); // create a buffer and tell it the data coming in is base64
    const [username, password] = buf.toString().split(":");

    return {
        username,
        password
    }
}