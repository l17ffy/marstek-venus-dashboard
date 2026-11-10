#!/usr/bin/env python3
"""Marstek Venus -> HTTP bridge. Браузер не вміє UDP, тому цей скрипт опитує батарею по локальному
Open API (UDP, порт 30000), веде облік енергії та історію (history.json) і віддає все дашборду.

Запуск:  python3 bridge.py --ip 192.168.1.50
Умова:   в застосунку Marstek увімкнено "Open API"; ПК у тій самій мережі, що й батарея.
Ендпоінти:  /status  — поточні дані + лічильники за сьогодні;  /history?p=today|month|year|all
Облік іде, доки міст запущений (запускайте його постійно: ПК, Raspberry Pi тощо).
"""
import argparse, atexit, json, os, signal, socket, sys, threading, time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ap = argparse.ArgumentParser()
ap.add_argument("--ip", required=True, help="IP батареї в локальній мережі")
ap.add_argument("--udp", type=int, default=30000, help="UDP-порт батареї (Open API)")
ap.add_argument("--bind-port", type=int, default=0, help="локальний UDP-порт; якщо відповідей нема, спробуйте 30000")
ap.add_argument("--port", type=int, default=8765, help="HTTP-порт для дашборду")
ap.add_argument("--every", type=float, default=5, help="інтервал опитування, с (не менше 3: пристрій не любить частих запитів)")
ap.add_argument("--invert", action="store_true", help="якщо bat_power у вашій прошивці має протилежний знак (заряд < 0)")
ap.add_argument("--data", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "history.json"), help="файл історії")
args = ap.parse_args()
EVERY = max(args.every, 3)

lock = threading.Lock()
state = {"ok": False, "ts": 0, "es": None, "bat": 0, "backup": 0, "error": "ще не опитано"}
last = {"ts": None, "bat": 0.0, "bak": 0.0}
ZERO = ("chg", "dis", "grid", "bak")  # кВт·год: заряджено, розряджено, заряд від мережі, віддано в резервну мережу
try:
    with open(args.data, encoding="utf-8") as f: hist = json.load(f)  # {"YYYY-MM-DDTHH": {chg, dis, grid, bak}}
except (OSError, ValueError):
    hist = {}

def accumulate(bat, bak, dt):
    e = hist.setdefault(datetime.now().strftime("%Y-%m-%dT%H"), dict.fromkeys(ZERO, 0.0))
    kwh = abs(bat) / 1000 * dt / 3600
    if bat > 0: e["chg"] += kwh; e["grid"] += kwh  # сонця немає — зарядка лише з мережі
    elif bat < 0: e["dis"] += kwh
    e["bak"] += bak / 1000 * dt / 3600

def save():
    with lock:
        tmp = args.data + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f: json.dump(hist, f)
        os.replace(tmp, args.data)

def agg(p):
    now = datetime.now()
    if p == "today": pre, n, ix, off = now.strftime("%Y-%m-%d"), now.hour // 4 + 1, lambda k: int(k[11:13]) // 4, 0
    elif p == "month": pre, n, ix, off = now.strftime("%Y-%m"), now.day, lambda k: int(k[8:10]) - 1, 1
    elif p == "year": pre, n, ix, off = now.strftime("%Y"), now.month, lambda k: int(k[5:7]) - 1, 0
    else:
        first = min([int(k[:4]) for k in hist] + [now.year])
        pre, n, ix, off = "", now.year - first + 1, lambda k: int(k[:4]) - first, first
    bars = [dict(k=i + off, **dict.fromkeys(ZERO, 0.0)) for i in range(n)]
    for k, e in hist.items():
        if k.startswith(pre) and 0 <= ix(k) < n:
            for z in ZERO: bars[ix(k)][z] += e[z]
    return [{key: round(v, 4) if key != "k" else v for key, v in b.items()} for b in bars]

def poll():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("", args.bind_port)); sock.settimeout(3)
    req = json.dumps({"id": 1, "method": "ES.GetStatus", "params": {"id": 0}}).encode()
    while True:
        try:
            sock.sendto(req, (args.ip, args.udp))
            data, _ = sock.recvfrom(4096)
            es = json.loads(data).get("result")
            if not isinstance(es, dict): raise ValueError("відповідь без result: %r" % data[:120])
            bat = float(es.get("bat_power") or 0) * (-1 if args.invert else 1)
            bak = float(es["offgrid_power"]) if isinstance(es.get("offgrid_power"), (int, float)) else max(0.0, -bat)
            now = time.time()
            with lock:
                if last["ts"] and now - last["ts"] <= 30:  # довгі розриви не інтегруємо
                    accumulate(last["bat"], last["bak"], now - last["ts"])
                last.update(ts=now, bat=bat, bak=bak)
                state.update(ok=True, ts=now, es=es, bat=bat, backup=bak, error=None)
        except Exception as e:  # таймаут, невалідний JSON тощо
            with lock: state.update(ok=False, error=str(e))
        time.sleep(EVERY)

def autosave():
    while True:
        time.sleep(30)
        try: save()
        except OSError as e: print("не вдалося зберегти історію:", e)

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        with lock:
            if u.path == "/status":
                stale = time.time() - state["ts"] > EVERY * 3
                today = {z: sum(b[z] for b in agg("today")) for z in ZERO}
                body = {**state, "ok": state["ok"] and not stale, "today": today}
            elif u.path == "/history":
                p = parse_qs(u.query).get("p", ["today"])[0]
                if p not in ("today", "month", "year", "all"): self.send_error(400); return
                body = {"p": p, "bars": agg(p)}
            else:
                self.send_error(404); return
        raw = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(raw)
    def log_message(self, *a): pass

atexit.register(lambda: (save() if hist else None))
signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))
threading.Thread(target=poll, daemon=True).start()
threading.Thread(target=autosave, daemon=True).start()
print("Міст працює: http://localhost:%d/status  (батарея %s:%d, історія: %s)" % (args.port, args.ip, args.udp, args.data))
try: ThreadingHTTPServer(("127.0.0.1", args.port), H).serve_forever()
except KeyboardInterrupt: pass
