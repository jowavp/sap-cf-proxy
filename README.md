# sap-cf-proxy - proxy to all destinations in SAP BTP Cloud Foundry subaccount

## Prerequisites

You are logged into your SAP BTP Cloud Foundry subaccount via the cf CLI and you have the Multitarget Build Tool installed (mbt). Until [sap-cf-localenv](https://github.com/jowavp/sap-cf-localenv) is setup for the project also jq needs to be installed.

## Setup

Run the following commands in a terminal window:

```
npm i
npm run build:mta
npm run deploy:cf
npm run start:sshtunnel
```

Go to the SAP BTP Cockpit and open the details of the deployed app *sshenabler*. Navigate there to the Environment Variables. Copy the content of the textbox *System Provided* to a local file called *default-env.json*. Then run the following commands in another terminal window:

```
export VCAP_SERVICES=`cat default-env.json | jq .VCAP_SERVICES`
npm start
```

## Testing

Using the VS Code Extension [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) you can execute the test in test/ping.http. Before you can run the test you have to create a .env file in the test folder with the following (of course adjusted) content:

```
sapcpproxy=http://localhost:5050
sapid_username="<user-email>"
sapid_password="<password>"
```

Connect a Cloud Connector to your Subaccount and create the following destinations:

* SAP_ABAP_BACKEND_NO_AUTH
* SAP_ABAP_BACKEND_BASIC_AUTH

Then run the test. The result should be:

`<html><body>Server reached.</body></html>`

in both cases.