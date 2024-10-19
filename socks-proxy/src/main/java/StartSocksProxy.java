import java.io.IOException;
import java.util.logging.Logger;

public class StartSocksProxy {
    static Logger LOGGER = Logger.getLogger(StartSocksProxy.class.getName());

    public static void main(String[] args) throws IOException {
        String onPremiseHost = System.getenv("ON_PREMISE_HOST");
        int onPremisePort = System.getenv("ON_PREMISE_PORT") != null ? Integer.parseInt(System.getenv("ON_PREMISE_PORT")) : 0;
        String cloudConnectorLocationId = System.getenv("CLOUD_CONNECTOR_LOCATION_ID");
        // default port 5050
        int port = (System.getenv("PORT") != null) ? Integer.parseInt(System.getenv("PORT")) : 5050;
        // default to using SSH tunnel
        boolean useSSHTunnel = (System.getenv("USE_SSH_TUNNEL") == null) || Boolean.parseBoolean(System.getenv("USE_SSH_TUNNEL"));
        
        if (onPremiseHost != null && onPremisePort != 0) {
            LOGGER.info("Starting up local SOCKS5 proxy to " + onPremiseHost + ":" + onPremisePort);
            ProxyServer proxy = new ProxyServer(port, onPremiseHost, onPremisePort, cloudConnectorLocationId, useSSHTunnel);
            proxy.run();
        } else {
            LOGGER.severe("Could not find ON_PREMISE_HOST and/or ON_PREMISE_PORT defined in any valid way");
        }
    }
}