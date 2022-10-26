import java.io.IOException;
import java.util.logging.Logger;

public class StartSocksProxy {
    static Logger LOGGER = Logger.getLogger(StartSocksProxy.class.getName());

    public static void main(String[] args) throws IOException {
        if (System.getenv("ON_PREMISE_HOST") != null && System.getenv("ON_PREMISE_PORT") != null) {
            String cloudConnectorLocationId = System.getenv("CLOUD_CONNECTOR_LOCATION_ID");
            String useSSHTunnelAsString = System.getenv("USE_SSH_TUNNEL");
            boolean useSSHTunnel = true;
            if (useSSHTunnelAsString != null) {
                useSSHTunnel = Boolean.parseBoolean(useSSHTunnelAsString);
            }
            LOGGER.info("Starting up local SOCKS5 proxy to " + System.getenv("ON_PREMISE_HOST") + ":" +
                    System.getenv("ON_PREMISE_HOST"));
            ProxyServer proxy = new ProxyServer(5050, System.getenv("ON_PREMISE_HOST"),
                    Integer.parseInt(System.getenv("ON_PREMISE_PORT")), cloudConnectorLocationId, useSSHTunnel);
            proxy.run();
        } else {
            LOGGER.severe("Could not find ON_PREMISE_HOST and/or ON_PREMISE_PORT defined in any valid way");
        }
    }
}
