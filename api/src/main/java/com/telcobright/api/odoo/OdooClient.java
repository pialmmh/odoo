package com.telcobright.api.odoo;

import com.telcobright.api.config.OdooProperties;
import jakarta.annotation.PostConstruct;
import org.apache.xmlrpc.client.XmlRpcClient;
import org.apache.xmlrpc.client.XmlRpcClientConfigImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URL;
import java.util.*;

/**
 * Generic Odoo XML-RPC client.
 * Authenticates once, then proxies any model/method call.
 */
@Component
public class OdooClient {

    private static final Logger log = LoggerFactory.getLogger(OdooClient.class);

    private final OdooProperties props;
    private XmlRpcClient objectClient;
    private int uid = -1;

    public OdooClient(OdooProperties props) {
        this.props = props;
    }

    @PostConstruct
    public void init() {
        try {
            authenticate();
            log.info("Odoo XML-RPC connected: {} (db={}, uid={})", props.getUrl(), props.getDb(), uid);
        } catch (Exception e) {
            log.warn("Odoo not reachable at startup ({}). Will retry on first call.", e.getMessage());
        }
    }

    private synchronized void authenticate() throws Exception {
        XmlRpcClientConfigImpl commonConfig = new XmlRpcClientConfigImpl();
        commonConfig.setServerURL(new URL(props.getUrl() + "/xmlrpc/2/common"));
        XmlRpcClient commonClient = new XmlRpcClient();
        commonClient.setConfig(commonConfig);

        Object result = commonClient.execute("authenticate", new Object[]{
                props.getDb(), props.getUsername(), props.getPassword(), Collections.emptyMap()
        });

        if (result instanceof Integer) {
            uid = (Integer) result;
        } else if (result instanceof Boolean && !(Boolean) result) {
            throw new RuntimeException("Odoo authentication failed: invalid credentials");
        } else {
            uid = ((Number) result).intValue();
        }

        XmlRpcClientConfigImpl objectConfig = new XmlRpcClientConfigImpl();
        objectConfig.setServerURL(new URL(props.getUrl() + "/xmlrpc/2/object"));
        objectClient = new XmlRpcClient();
        objectClient.setConfig(objectConfig);
    }

    /**
     * Call any Odoo model method.
     * Equivalent to: models.execute_kw(db, uid, password, model, method, args, kwargs)
     */
    public Object call(String model, String method, Object[] args, Map<String, Object> kwargs) throws Exception {
        if (uid < 0 || objectClient == null) {
            authenticate();
        }

        Object[] rpcArgs;
        if (kwargs != null && !kwargs.isEmpty()) {
            rpcArgs = new Object[]{
                    props.getDb(), uid, props.getPassword(),
                    model, method, args != null ? args : new Object[]{},
                    kwargs
            };
        } else {
            rpcArgs = new Object[]{
                    props.getDb(), uid, props.getPassword(),
                    model, method, args != null ? args : new Object[]{}
            };
        }

        return objectClient.execute("execute_kw", rpcArgs);
    }

    /**
     * Convenience: call with args only, no kwargs.
     */
    public Object call(String model, String method, Object[] args) throws Exception {
        return call(model, method, args, null);
    }

    public int getUid() {
        return uid;
    }

    public boolean isConnected() {
        return uid > 0 && objectClient != null;
    }
}
