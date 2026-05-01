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
import java.util.concurrent.ConcurrentHashMap;

/**
 * Generic Odoo XML-RPC client with per-DB uid cache.
 *
 * Each tenant lives in its own Postgres database. We authenticate once per DB
 * and keep the uid in {@link #uidByDb}. Callers pass the DB name explicitly;
 * the no-DB overload uses {@link OdooProperties#getDb()} (default DB) for
 * back-compat with non-tenanted routes.
 */
@Component
public class OdooClient {

    private static final Logger log = LoggerFactory.getLogger(OdooClient.class);

    private final OdooProperties props;
    private XmlRpcClient commonClient;
    private XmlRpcClient objectClient;
    private final Map<String, Integer> uidByDb = new ConcurrentHashMap<>();

    public OdooClient(OdooProperties props) {
        this.props = props;
    }

    @PostConstruct
    public void init() {
        try {
            initRpcClients();
            int uid = authenticate(props.getDb());
            log.info("Odoo XML-RPC connected: {} (defaultDb={}, uid={})", props.getUrl(), props.getDb(), uid);
        } catch (Exception e) {
            log.warn("Odoo not reachable at startup ({}). Will retry on first call.", e.getMessage());
        }
    }

    private synchronized void initRpcClients() throws Exception {
        if (commonClient != null && objectClient != null) return;
        XmlRpcClientConfigImpl commonConfig = new XmlRpcClientConfigImpl();
        commonConfig.setServerURL(new URL(props.getUrl() + "/xmlrpc/2/common"));
        commonClient = new XmlRpcClient();
        commonClient.setConfig(commonConfig);

        XmlRpcClientConfigImpl objectConfig = new XmlRpcClientConfigImpl();
        objectConfig.setServerURL(new URL(props.getUrl() + "/xmlrpc/2/object"));
        objectClient = new XmlRpcClient();
        objectClient.setConfig(objectConfig);
    }

    private int authenticate(String db) throws Exception {
        initRpcClients();
        Object result = commonClient.execute("authenticate", new Object[]{
                db, props.getUsername(), props.getPassword(), Collections.emptyMap()
        });
        if (result instanceof Boolean && !(Boolean) result) {
            throw new RuntimeException("Odoo authentication failed for db=" + db + " (invalid credentials or DB missing)");
        }
        int uid = ((Number) result).intValue();
        uidByDb.put(db, uid);
        log.info("Odoo authenticated: db={}, uid={}", db, uid);
        return uid;
    }

    private int uidFor(String db) throws Exception {
        Integer uid = uidByDb.get(db);
        if (uid == null) uid = authenticate(db);
        return uid;
    }

    /**
     * Call any Odoo model method against a specific DB.
     * Equivalent to: models.execute_kw(db, uid, password, model, method, args, kwargs)
     */
    public Object call(String db, String model, String method, Object[] args, Map<String, Object> kwargs) throws Exception {
        if (db == null || db.isBlank()) db = props.getDb();
        int uid = uidFor(db);

        Object[] rpcArgs;
        if (kwargs != null && !kwargs.isEmpty()) {
            rpcArgs = new Object[]{
                    db, uid, props.getPassword(),
                    model, method, args != null ? args : new Object[]{},
                    kwargs
            };
        } else {
            rpcArgs = new Object[]{
                    db, uid, props.getPassword(),
                    model, method, args != null ? args : new Object[]{}
            };
        }
        return objectClient.execute("execute_kw", rpcArgs);
    }

    /** Default-DB convenience overload (back-compat for callers without tenant context). */
    public Object call(String model, String method, Object[] args, Map<String, Object> kwargs) throws Exception {
        return call(props.getDb(), model, method, args, kwargs);
    }

    public Object call(String model, String method, Object[] args) throws Exception {
        return call(props.getDb(), model, method, args, null);
    }

    public int getUid() {
        Integer uid = uidByDb.get(props.getDb());
        return uid != null ? uid : -1;
    }

    public int getUid(String db) {
        Integer uid = uidByDb.get(db);
        return uid != null ? uid : -1;
    }

    public boolean isConnected() {
        return getUid() > 0 && objectClient != null;
    }

    /** Drop cached uid for a DB; next call re-authenticates. Useful after admin password change. */
    public void invalidate(String db) {
        uidByDb.remove(db);
    }
}
