/**
 * WebSocket message discriminated unions.
 *
 * The backend sends loosely-typed dicts; these types mirror what each collector
 * broadcasts so the frontend can discriminate on `type` safely.
 */

export type Envelope<T extends WsMessage = WsMessage> = {
  type: T["type"];
  ts: number;
  data: T["data"];
};

// -- Per-message type definitions ---------------------------------------------

export type CpuMsg = {
  type: "cpu";
  data: {
    usage_percent: number;
    frequency_ghz: number;
    temp_c: number;
    per_core: number[];
  };
};

export type MemoryMsg = {
  type: "memory";
  data: {
    percent: number;
    used_gb: number;
    total_gb: number;
  };
};

export type GpuProc = { pid: number; name: string; vram_mb: number };

export type GpuMsg = {
  type: "gpu";
  data: {
    utilization_percent: number;
    temp_c: number;
    power_w: number;
    vram_percent: number;
    vram_used_mb: number;
    vram_total_mb: number;
    top_processes: GpuProc[];
  };
};

export type DiskMsg = {
  type: "disk";
  data: {
    usage_percent: number;
    used_gb: number;
    total_gb: number;
    io_read_bps: number;
    io_write_bps: number;
    nvme_temp_c: number;
  };
};

export type NetworkMsg = {
  type: "network";
  data: {
    ssid: string | null;
    signal_dbm: number | null;
    signal_percent: number | null;
    frequency_mhz: number | null;
    ip_local: string | null;
    ip_public: string | null;
    download_bps: number;
    upload_bps: number;
    ping_ms: number | null;
    tailscale: {
      connected: boolean;
      ip: string | null;
      exit_node: string | null;
    };
  };
};

export type WifiNetwork = {
  ssid: string;
  signal_percent: number;
  frequency: number;
  security: string;
  connected: boolean;
};

export type WifiScanMsg = {
  type: "wifi_scan";
  data: { networks: WifiNetwork[] };
};

export type WeatherMsg = {
  type: "weather";
  data: { temp: number; icon: string };
};

export type ProcessesMsg = {
  type: "processes";
  data: { top_cpu: { name: string; cpu_percent: number }[] };
};

export type DockerContainer = { name: string; status: string; image: string };

export type SystemMsg = {
  type: "system";
  data: {
    hostname: string;
    kernel: string;
    os: string;
    uptime_s: number;
    cpu_model: string;
    gpu_model: string;
    ram_model: string;
    disk_model: string;
    docker_containers: DockerContainer[];
  };
};

export type OllamaMsg = {
  type: "ollama";
  data: {
    running: boolean;
    model: string | null;
    status: string;
  };
};

export type NotificationItem = {
  id: number;
  app: string;
  icon: string | null;
  summary: string;
  body: string;
  ts: number;
};

export type NotificationsMsg = {
  type: "notifications";
  data: { list: NotificationItem[] };
};

/** Phase 7 — ambient wallpaper page. Driven by /tmp/ambilight-color collector. */
export type AmbilightMsg = {
  type: "ambilight";
  data: { r: number; g: number; b: number };
};

// -- Union --------------------------------------------------------------------

export type WsMessage =
  | CpuMsg
  | MemoryMsg
  | GpuMsg
  | DiskMsg
  | NetworkMsg
  | WifiScanMsg
  | WeatherMsg
  | ProcessesMsg
  | SystemMsg
  | OllamaMsg
  | NotificationsMsg
  | AmbilightMsg;

export type WsMessageType = WsMessage["type"];

/** Narrow `data` by message type. */
export type DataFor<T extends WsMessageType> = Extract<WsMessage, { type: T }>["data"];
