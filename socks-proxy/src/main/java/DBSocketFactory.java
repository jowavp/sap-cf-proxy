import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestTemplate;

import javax.net.SocketFactory;
import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;

public class DBSocketFactory extends SocketFactory {

	private final boolean useSSHTunnel;
	private final String locationId;

	public DBSocketFactory(String cloudConnectorLocationId, boolean useSSHTunnel) {
		super();
		this.useSSHTunnel = useSSHTunnel;
		this.locationId = cloudConnectorLocationId;
	}
	
	@Override
	public Socket createSocket() throws IOException {
		JSONObject credentials = extractEnvironmentCredentials();
		String client_id = credentials.getString("clientid");
		String client_secret = credentials.getString("clientsecret");
		String tokenUrl = credentials.getString("url") + "/oauth/token?grant_type=client_credentials";
		
		RestTemplate template = new RestTemplate();
		HttpHeaders headers = new HttpHeaders();
		headers.setBasicAuth(client_id, client_secret);
		HttpEntity<String> entity =  new HttpEntity<String>(headers);
		
		String response = template.exchange(tokenUrl,HttpMethod.GET, entity, String.class).getBody();
		
		JSONObject obj = new JSONObject(response);
		return new ConnectivitySocks5ProxySocket(obj.getString("access_token"), locationId, useSSHTunnel);
	}

	@Override
	public Socket createSocket(String arg0, int arg1) {
		throw new UnsupportedOperationException();
	}

	@Override
	public Socket createSocket(InetAddress arg0, int arg1) {
		throw new UnsupportedOperationException();
	}

	@Override
	public Socket createSocket(String arg0, int arg1, InetAddress arg2, int arg3) {
		throw new UnsupportedOperationException();
	}

	@Override
	public Socket createSocket(InetAddress arg0, int arg1, InetAddress arg2, int arg3) {
		throw new UnsupportedOperationException();
	}

	
	private JSONObject extractEnvironmentCredentials() throws JSONException {
        JSONObject jsonObj = new JSONObject(System.getenv("VCAP_SERVICES"));
        JSONArray jsonArr = jsonObj.getJSONArray("connectivity");
        return jsonArr.getJSONObject(0).getJSONObject("credentials");
    }
	
}
