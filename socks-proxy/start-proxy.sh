#!/bin/bash
export $(grep -v '^#' .env | xargs)
VCAP_SERVICES=$(jq '.VCAP_SERVICES' default-env.json|jq -c .) mvn compile exec:java -Dexec.mainClass="StartSocksProxy" 
