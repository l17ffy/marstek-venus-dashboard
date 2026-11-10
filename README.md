# Marstek Venus A 666e Web Dashboard & Bridge

A lightweight web dashboard and local HTTP/UDP bridge for real-time monitoring of **Marstek Venus** energy storage systems.

Because web browsers cannot open raw UDP sockets, this project provides a standalone Python bridge (`bridge.py`). It communicates with the battery via its local **Open API**, tracks and persists energy metrics in `history.json`, and exposes a RESTful JSON API for the frontend dashboard.

## ⚡️ Features

* **Real-Time Monitoring**: Battery level (%), power flow (W), backup circuit load (W), and grid charging stats.
* **Energy Accounting**: Aggregates charge/discharge totals (kWh) over multiple time windows:
  * **Now**: live power graph over the last 30 seconds
  * **Today**: energy grouped in 4-hour intervals
  * **Month**: daily energy breakdown
  * **Year**: monthly breakdown
  * **Total**: yearly breakdown across all recorded history
* **Local & Private**: Runs entirely within your local network — no cloud services, accounts, or external tracking required.
* **Fallback / Demo Mode**: Automatically simulates realistic battery activity when the bridge is unreachable (or explicitly via the `?demo` query flag).
* **Bilingual UI**: Full support for English (`en`) and Ukrainian (`uk`), stored in `localStorage`.
* **Adaptive Theme & Layout**: Mobile-first responsive design supporting automatic system light and dark color schemes.

## 📂 Project Structure

```
.
├── bridge.py       # Local UDP ↔ HTTP bridge written in Python 3
├── index.html      # Dashboard markup and SVG gauges
├── style.css       # Clean, dependency-free CSS (Mobile-first, dark/light themes)
├── script.js       # Dashboard polling logic, canvas/SVG rendering, and UI state
├── i18n.js         # Localization strings (UK / EN)
└── history.json    # Local persistent storage for energy accounting
```

## 🚀 Quick Start

### 1. Prerequisites

1. Ensure your computer/server (e.g., Raspberry Pi) is connected to the **same local network (Wi-Fi or LAN)** as the Marstek battery.
2. In the official **Marstek** mobile app, open the device settings and enable **Open API**.
3. Identify your battery's local IP address (via your router's client list or the mobile app).

### 2. Run the Bridge (`bridge.py`)

The bridge requires only standard Python 3 libraries (`socket`, `http.server`, `threading`, `json`, etc.) — no third-party dependencies to install.

Run the script by providing your battery's local IP address:

```bash
python3 bridge.py --ip 192.168.1.50
```

#### CLI Options:

| Option | Default | Description |
| :--- | :--- | :--- |
| `--ip` | *(required)* | Local IP address of the Marstek battery |
| `--udp` | `30000` | UDP port used by the battery's Open API |
| `--bind-port` | `0` | Local port to bind for incoming UDP replies (try `30000` if replies time out) |
| `--port` | `8765` | Local HTTP port for the web dashboard |
| `--every` | `5` | Polling frequency in seconds (minimum `3` to avoid device throttling) |
| `--invert` | `False` | Inverts the sign of `bat_power` if your firmware reports charging as negative |
| `--data` | `history.json` | Path to the JSON file where hourly statistics are saved |

### 3. Open the Dashboard

Once `bridge.py` is running, open `index.html` in any modern web browser:

* Directly as a file: `file:///path/to/index.html`
* Or serve the directory using Python's static file server:

  ```bash
  python3 -m http.server 8080
  ```

  Then navigate to `http://localhost:8080`.

## 🔌 HTTP API Endpoints

The bridge exposes two lightweight JSON endpoints:

* **`GET /status`**: Returns current device telemetry (`bat_power`, `offgrid_power`, `bat_soc`) along with today's accumulated totals.
* **`GET /history?p={today|month|year|all}`**: Returns aggregated energy bars (charge, discharge, grid, backup) for the requested timeframe.

## 🔒 Privacy

This project does not transmit personal data or telemetry outside your local network. The `history.json` file only contains technical timestamps and hourly energy measurements.