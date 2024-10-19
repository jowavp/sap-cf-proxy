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
        while (true) {
            try {
                Socket client = serverSocket.accept();
                // Handle each connection in a new thread
                new Thread(() -> handleClientConnection(client)).start();
            } catch (IOException e) {
                LOGGER.throwing("ProxyServer", "run", e);
            }
        }
    }

    private void handleClientConnection(Socket client) {
        final byte[] request = new byte[1024];
        final byte[] reply = new byte[4096];

        try (Socket socketToProxy = new DBSocketFactory(cloudConnectorLocationId, useSSHTunnel).createSocket()) {
            socketToProxy.connect(InetSocketAddress.createUnresolved(hostname, port));

            final InputStream streamFromServer = socketToProxy.getInputStream();
            final OutputStream streamToServer = socketToProxy.getOutputStream();

            final InputStream streamFromClient = client.getInputStream();
            final OutputStream streamToClient = client.getOutputStream();

            // Create a thread to handle client to server
            Thread clientToServer = new Thread(() -> {
                try {
                    int bytesRead;
                    while (!client.isClosed() && (bytesRead = streamFromClient.read(request)) != -1) {
                        streamToServer.write(request, 0, bytesRead);
                        streamToServer.flush();
                    }
                } catch (IOException e) {
                    LOGGER.throwing("ProxyServer", "clientToServer", e);
                }
            });

            // Create a thread to handle server to client
            Thread serverToClient = new Thread(() -> {
                try {
                    int bytesRead;
                    while ((bytesRead = streamFromServer.read(reply)) != -1) {
                        streamToClient.write(reply, 0, bytesRead);
                        streamToClient.flush();
                    }
                } catch (IOException e) {
                    LOGGER.throwing("ProxyServer", "serverToClient", e);
                }
            });

            clientToServer.start();
            serverToClient.start();

            clientToServer.join();
            serverToClient.join();

        } catch (IOException | InterruptedException e) {
            LOGGER.throwing("ProxyServer", "handleClientConnection", e);
        } finally {
            try {
                // Ensure the client socket is closed and threads can exit
                if (client != null) client.close();
                LOGGER.info("Client disconnected, cleaning up");
            } catch (IOException e) {
                LOGGER.throwing("ProxyServer", "handleClientConnection", e);
            }
        }
    }
}
