import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.logging.Logger;

public class ProxyServer {
    private static final Logger LOGGER = Logger.getLogger(ProxyServer.class.getName());

    private final ServerSocket serverSocket;
    private final String hostname;
    private final int port;
    private final String cloudConnectorLocationId;
    private final boolean useSSHTunnel;

    public ProxyServer(int port, String hostnameToReach, int portToReach, String cloudConnectorLocationId, boolean useSSHTunnel) throws IOException {
        this.serverSocket = new ServerSocket(port);
        this.hostname = hostnameToReach;
        this.port = portToReach;
        this.cloudConnectorLocationId = cloudConnectorLocationId;
        this.useSSHTunnel = useSSHTunnel;
        LOGGER.info("Initialized SOCKS5 proxy server listening on 127.0.0.1:" + port + " " + (useSSHTunnel ?
                "by using the SSH tunnel on localhost:20004": "by not using the SSH tunnel"));
    }

    public void run() throws IOException {
        final byte[] request = new byte[1024];
        byte[] reply = new byte[4096];

        //noinspection InfiniteLoopStatement
        while (true) {
            Socket client;
            try {
                client = serverSocket.accept();
                try (Socket socketToProxy = new DBSocketFactory(cloudConnectorLocationId, useSSHTunnel).createSocket()) {
                    socketToProxy.connect(InetSocketAddress.createUnresolved(hostname, port));

                    final InputStream streamFromServer = socketToProxy.getInputStream();
                    final OutputStream streamToServer = socketToProxy.getOutputStream();

                    final InputStream streamFromClient = client.getInputStream();
                    final OutputStream streamToClient = client.getOutputStream();

                    final Socket currentClient = client;
                    Thread t = new Thread(() -> {
                        int bytesRead;
                        try {
                            while (!currentClient.isClosed() && (bytesRead = streamFromClient.read(request)) != -1) {
                                streamToServer.write(request, 0, bytesRead);
                                streamToServer.flush();
                            }
                        } catch (IOException e) {
                            LOGGER.throwing("ProxyServer", "run", e);
                        }
                    });

                    t.start();

                    int bytesRead;
                    try {
                        while ((bytesRead = streamFromServer.read(reply)) != -1) {
                            streamToClient.write(reply, 0, bytesRead);
                            streamToClient.flush();
                        }
                    } catch (IOException e) {
                        LOGGER.throwing("ProxyServer", "run", e);
                    }

                    streamToClient.close();
                } catch (IOException e) {
                    LOGGER.throwing("ProxyServer", "run", e);
                } finally {
                    try {
                        if (client != null)
                            client.close();
                    } catch (IOException e) {
                        LOGGER.throwing("ProxyServer", "run", e);
                    }
                }
            } catch (IOException e) {
                LOGGER.throwing("ProxyServer", "run", e);
            }
        }
    }
}
