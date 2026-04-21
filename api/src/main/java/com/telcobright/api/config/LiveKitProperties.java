package com.telcobright.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "livekit")
public class LiveKitProperties {
    private boolean enabled = false;
    private String wsUrl = "";
    /** LiveKit server HTTP base for server-to-server admin calls (egress, room service). */
    private String httpUrl = "";
    private String apiKey = "";
    private String apiSecret = "";
    private long tokenTtlSeconds = 7200;
    /** Host path where egress-produced MP4 files land, must be readable by platform-api. */
    private String recordingsDir = "/var/lib/livekit-meet/recordings";
    /** Same directory as seen from inside the egress container (used in egress filepath template). */
    private String recordingsDirEgress = "/out";
    /** Public base URL used when minting share/magic-link URLs (e.g. https://hcc.example:30002). */
    private String publicBaseUrl = "";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getWsUrl() { return wsUrl; }
    public void setWsUrl(String wsUrl) { this.wsUrl = wsUrl; }
    public String getHttpUrl() { return httpUrl; }
    public void setHttpUrl(String httpUrl) { this.httpUrl = httpUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getApiSecret() { return apiSecret; }
    public void setApiSecret(String apiSecret) { this.apiSecret = apiSecret; }
    public long getTokenTtlSeconds() { return tokenTtlSeconds; }
    public void setTokenTtlSeconds(long tokenTtlSeconds) { this.tokenTtlSeconds = tokenTtlSeconds; }
    public String getRecordingsDir() { return recordingsDir; }
    public void setRecordingsDir(String recordingsDir) { this.recordingsDir = recordingsDir; }
    public String getRecordingsDirEgress() { return recordingsDirEgress; }
    public void setRecordingsDirEgress(String recordingsDirEgress) { this.recordingsDirEgress = recordingsDirEgress; }
    public String getPublicBaseUrl() { return publicBaseUrl; }
    public void setPublicBaseUrl(String publicBaseUrl) { this.publicBaseUrl = publicBaseUrl; }
}
