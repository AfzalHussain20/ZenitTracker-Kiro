"""
Zenit Vision — Real ADB WebSocket Server
Port: 8767
Handles: device detection, screen streaming, hierarchy capture, interactions, script execution
"""

import asyncio
import base64
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("vision")

app = FastAPI(title="Zenit Vision Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# ADB BRIDGE
# ─────────────────────────────────────────────────────────────

async def adb(*args, timeout=10) -> tuple[int, bytes, bytes]:
    """Run an adb command, return (returncode, stdout, stderr)."""
    cmd = ["adb"] + list(args)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return proc.returncode, stdout, stderr
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        return -1, b"", b"timeout"
    except FileNotFoundError:
        return -1, b"", b"adb not found"


async def adb_s(*args, udid: str, timeout=10) -> tuple[int, bytes, bytes]:
    """Run adb -s <udid> <args>."""
    return await adb("-s", udid, *args, timeout=timeout)


async def get_devices() -> list[dict]:
    """Return list of connected authorized devices."""
    rc, out, _ = await adb("devices", "-l")
    if rc != 0:
        return []
    devices = []
    for line in out.decode(errors="replace").splitlines()[1:]:
        line = line.strip()
        if not line or "offline" in line or "unauthorized" in line:
            continue
        parts = line.split()
        if len(parts) < 2 or parts[1] != "device":
            continue
        udid = parts[0]
        model = ""
        for p in parts[2:]:
            if p.startswith("model:"):
                model = p[6:].replace("_", " ")
                break
        if not model:
            _, mout, _ = await adb_s("shell", "getprop", "ro.product.model", udid=udid, timeout=5)
            model = mout.decode(errors="replace").strip() or udid
        devices.append({"id": udid, "model": model})
    return devices


async def get_foreground_package(udid: str) -> str:
    """Get the foreground app package name."""
    _, out, _ = await adb_s("shell", "dumpsys", "window", "windows", udid=udid, timeout=8)
    text = out.decode(errors="replace")
    # Try mCurrentFocus first
    m = re.search(r"mCurrentFocus=Window\{[^}]+\s+([\w.]+)/", text)
    if m:
        return m.group(1)
    m = re.search(r"mFocusedApp=.*ActivityRecord\{[^}]+\s+([\w.]+)/", text)
    if m:
        return m.group(1)
    return ""


async def screencap(udid: str) -> Optional[bytes]:
    """Capture screenshot as PNG bytes."""
    rc, out, _ = await adb_s("exec-out", "screencap", "-p", udid=udid, timeout=8)
    if rc != 0 or len(out) < 100:
        return None
    return out


async def get_screen_size(udid: str) -> tuple[int, int]:
    """Return (width, height) of device screen."""
    _, out, _ = await adb_s("shell", "wm", "size", udid=udid, timeout=5)
    text = out.decode(errors="replace")
    m = re.search(r"(\d+)x(\d+)", text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 1080, 1920


async def dump_hierarchy(udid: str) -> Optional[str]:
    """Dump UI hierarchy XML from device."""
    await adb_s("shell", "uiautomator", "dump", "/sdcard/window_dump.xml", udid=udid, timeout=8)
    rc, out, _ = await adb_s("pull", "/sdcard/window_dump.xml", "/tmp/window_dump.xml", udid=udid, timeout=8)
    if rc != 0:
        return None
    try:
        with open("/tmp/window_dump.xml", "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────
# HIERARCHY PARSER
# ─────────────────────────────────────────────────────────────

def parse_bounds(bounds_str: str, w: int, h: int) -> dict:
    """Parse '[x1,y1][x2,y2]' into normalized ratio bounds."""
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds_str or "")
    if not m:
        return {"x": 0, "y": 0, "width": 0, "height": 0}
    x1, y1, x2, y2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return {
        "x": round(x1 / w, 4),
        "y": round(y1 / h, 4),
        "width": round((x2 - x1) / w, 4),
        "height": round((y2 - y1) / h, 4),
    }


def normalize_node(elem: ET.Element, w: int, h: int, idx: int = 0) -> dict:
    """Recursively normalize an XML element into the Vision node schema."""
    a = elem.attrib
    class_name = a.get("class", "")
    short_type = class_name.split(".")[-1] if class_name else "View"
    resource_id = a.get("resource-id", "")
    content_desc = a.get("content-desc", "")
    text = a.get("text", "")
    bounds = parse_bounds(a.get("bounds", ""), w, h)
    node_id = resource_id or f"{short_type}_{idx}_{bounds['x']}_{bounds['y']}"

    children = []
    for i, child in enumerate(elem):
        children.append(normalize_node(child, w, h, i))

    return {
        "id": node_id,
        "type": class_name,
        "name": content_desc or text or short_type,
        "attributes": {
            "resourceId": resource_id,
            "contentDesc": content_desc,
            "text": text,
            "bounds": bounds,
            "clickable": a.get("clickable") == "true",
            "enabled": a.get("enabled") == "true",
            "scrollable": a.get("scrollable") == "true",
            "focusable": a.get("focusable") == "true",
            "selected": a.get("selected") == "true",
            "index": int(a.get("index", idx)),
        },
        "children": children,
    }


def parse_hierarchy_xml(xml_str: str, w: int, h: int) -> Optional[dict]:
    """Parse uiautomator XML into normalized tree."""
    try:
        root = ET.fromstring(xml_str)
        # uiautomator dump wraps in <hierarchy>, get first child
        if root.tag == "hierarchy":
            children = list(root)
            if children:
                return normalize_node(children[0], w, h)
        return normalize_node(root, w, h)
    except Exception as e:
        log.error(f"Hierarchy parse error: {e}")
        return None


# ─────────────────────────────────────────────────────────────
# SESSION STATE
# ─────────────────────────────────────────────────────────────

@dataclass
class DeviceSession:
    udid: str = ""
    model: str = ""
    screen_w: int = 1080
    screen_h: int = 1920
    current_package: str = ""
    hierarchy: Optional[dict] = None
    hierarchy_stale: bool = False
    streamer_task: Optional[asyncio.Task] = None
    runner_proc: Optional[asyncio.subprocess.Process] = None
    ws: Optional[WebSocket] = None


sessions: dict[str, DeviceSession] = {}


# ─────────────────────────────────────────────────────────────
# SCREEN STREAMER
# ─────────────────────────────────────────────────────────────

async def stream_screen(session_id: str):
    """Continuously capture and push frames to the client."""
    sess = sessions.get(session_id)
    if not sess:
        return
    log.info(f"[{session_id}] Screen streamer started for {sess.udid}")
    fail_count = 0
    while session_id in sessions and sessions[session_id].ws:
        try:
            png = await screencap(sess.udid)
            if png:
                fail_count = 0
                b64 = base64.b64encode(png).decode()
                await sess.ws.send_json({"type": "frame", "screenshot": b64, "afterAction": False})
            else:
                fail_count += 1
                if fail_count > 5:
                    log.warning(f"[{session_id}] Screencap failing repeatedly")
                await asyncio.sleep(0.5)
                continue
            await asyncio.sleep(0.2)  # ~5 fps
        except Exception as e:
            log.error(f"[{session_id}] Streamer error: {e}")
            await asyncio.sleep(0.5)
    log.info(f"[{session_id}] Screen streamer stopped")


async def capture_after_action(session_id: str):
    """Capture a fresh frame after an action and mark it afterAction=true."""
    await asyncio.sleep(0.6)
    sess = sessions.get(session_id)
    if not sess or not sess.ws:
        return
    try:
        png = await screencap(sess.udid)
        if png:
            b64 = base64.b64encode(png).decode()
            await sess.ws.send_json({"type": "frame", "screenshot": b64, "afterAction": True})
    except Exception:
        pass


async def refresh_hierarchy_task(session_id: str):
    """Refresh hierarchy after action settles."""
    await asyncio.sleep(0.5)
    sess = sessions.get(session_id)
    if not sess or not sess.ws:
        return
    try:
        xml = await dump_hierarchy(sess.udid)
        if xml:
            tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
            if tree:
                sess.hierarchy = tree
                sess.hierarchy_stale = False
                pkg = await get_foreground_package(sess.udid)
                sess.current_package = pkg
                await sess.ws.send_json({
                    "type": "state",
                    "hierarchy": tree,
                    "currentPackage": pkg,
                    "deviceModel": sess.model,
                })
    except Exception as e:
        log.error(f"[{session_id}] Hierarchy refresh error: {e}")


# ─────────────────────────────────────────────────────────────
# DEVICE ACTIONS
# ─────────────────────────────────────────────────────────────

async def do_tap(udid: str, ratio_x: float, ratio_y: float, w: int, h: int):
    x = int(ratio_x * w)
    y = int(ratio_y * h)
    await adb_s("shell", "input", "tap", str(x), str(y), udid=udid)


async def do_swipe(udid: str, rx1: float, ry1: float, rx2: float, ry2: float, w: int, h: int, duration_ms: int = 300):
    x1, y1 = int(rx1 * w), int(ry1 * h)
    x2, y2 = int(rx2 * w), int(ry2 * h)
    await adb_s("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration_ms), udid=udid)


async def do_long_press(udid: str, rx: float, ry: float, w: int, h: int, duration_ms: int = 1500):
    x, y = int(rx * w), int(ry * h)
    await adb_s("shell", "input", "swipe", str(x), str(y), str(x), str(y), str(duration_ms), udid=udid)


async def do_double_tap(udid: str, rx: float, ry: float, w: int, h: int):
    x, y = int(rx * w), int(ry * h)
    await adb_s("shell", "input", "tap", str(x), str(y), udid=udid)
    await asyncio.sleep(0.1)
    await adb_s("shell", "input", "tap", str(x), str(y), udid=udid)


async def do_type(udid: str, text: str, enter: bool = False):
    # Escape special chars for adb input text
    escaped = text.replace(" ", "%s").replace("'", "\\'").replace('"', '\\"').replace("&", "\\&")
    await adb_s("shell", "input", "text", escaped, udid=udid)
    if enter:
        await adb_s("shell", "input", "keyevent", "66", udid=udid)


async def do_keyevent(udid: str, keycode: int):
    await adb_s("shell", "input", "keyevent", str(keycode), udid=udid)


def find_element_at(node: dict, rx: float, ry: float) -> Optional[dict]:
    """Find deepest element at ratio coordinates."""
    if not node:
        return None
    b = node.get("attributes", {}).get("bounds", {})
    if not b:
        return None
    if rx < b["x"] or rx > b["x"] + b["width"] or ry < b["y"] or ry > b["y"] + b["height"]:
        return None
    for child in node.get("children", []):
        hit = find_element_at(child, rx, ry)
        if hit:
            return hit
    return node


def build_locators(node: dict) -> dict:
    """Build locator dict from a node."""
    if not node:
        return {}
    a = node.get("attributes", {})
    rid = a.get("resourceId", "")
    cd = a.get("contentDesc", "")
    txt = a.get("text", "")
    cls = node.get("type", "").split(".")[-1] or "*"
    xpath = ""
    if rid:
        xpath = f"//{cls}[@resource-id='{rid}']"
    elif cd:
        xpath = f"//{cls}[@content-desc='{cd}']"
    elif txt:
        xpath = f"//{cls}[@text='{txt}']"
    else:
        xpath = f"//{cls}"
    return {
        "resourceId": rid,
        "accessibilityId": cd,
        "text": txt,
        "className": node.get("type", ""),
        "xpath": xpath,
    }


# ─────────────────────────────────────────────────────────────
# SCRIPT RUNNER
# ─────────────────────────────────────────────────────────────

async def run_script(session_id: str, script: str, language: str):
    """Execute a script in a subprocess and stream output."""
    sess = sessions.get(session_id)
    if not sess or not sess.ws:
        return

    ext = ".py" if language == "python" else ".js"
    interpreter = "python3" if language == "python" else "node"

    with tempfile.NamedTemporaryFile(mode="w", suffix=ext, delete=False, encoding="utf-8") as f:
        f.write(script)
        tmp_path = f.name

    async def send_log(msg: str, level: str = "info"):
        try:
            await sess.ws.send_json({"type": "log", "message": msg, "level": level})
        except Exception:
            pass

    await send_log(f"▶  Starting {language} script…", "info")

    try:
        proc = await asyncio.create_subprocess_exec(
            interpreter, tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        sess.runner_proc = proc

        async def read_stream(stream, level: str):
            while True:
                line = await stream.readline()
                if not line:
                    break
                await send_log(line.decode(errors="replace").rstrip(), level)

        try:
            await asyncio.wait_for(
                asyncio.gather(
                    read_stream(proc.stdout, "info"),
                    read_stream(proc.stderr, "error"),
                    proc.wait(),
                ),
                timeout=300,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await send_log("Execution timed out after 300 seconds", "error")
            return

        if proc.returncode == 0:
            await send_log("Script completed successfully", "success")
        else:
            await send_log(f"Script failed with exit code {proc.returncode}", "error")

    except FileNotFoundError:
        await send_log(f"Interpreter '{interpreter}' not found. Install it and try again.", "error")
    except Exception as e:
        await send_log(f"Runner error: {e}", "error")
    finally:
        sess.runner_proc = None
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


async def run_dsl(session_id: str, lines: list[str]):
    """Execute ADB DSL commands line by line."""
    sess = sessions.get(session_id)
    if not sess or not sess.ws:
        return

    async def send_log(msg: str, level: str = "info"):
        try:
            await sess.ws.send_json({"type": "log", "message": msg, "level": level})
        except Exception:
            pass

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        cmd = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        await send_log(f"$ {line}", "info")
        try:
            if cmd == "tap":
                xy = args.split()
                if len(xy) >= 2:
                    await adb_s("shell", "input", "tap", xy[0], xy[1], udid=sess.udid)
            elif cmd == "type":
                await do_type(sess.udid, args)
            elif cmd == "swipe":
                xy = args.split()
                if len(xy) >= 4:
                    dur = xy[4] if len(xy) > 4 else "300"
                    await adb_s("shell", "input", "swipe", xy[0], xy[1], xy[2], xy[3], dur, udid=sess.udid)
            elif cmd == "home":
                await do_keyevent(sess.udid, 3)
            elif cmd == "back":
                await do_keyevent(sess.udid, 4)
            elif cmd == "wait":
                secs = float(args) if args else 1.0
                await asyncio.sleep(secs)
            elif cmd == "screenshot":
                png = await screencap(sess.udid)
                if png:
                    b64 = base64.b64encode(png).decode()
                    await sess.ws.send_json({"type": "frame", "screenshot": b64, "afterAction": True})
                    await send_log("Screenshot captured", "success")
            else:
                await send_log(f"Unknown command: {cmd}", "warn")
        except Exception as e:
            await send_log(f"Error executing '{line}': {e}", "error")

    await sess.ws.send_json({"type": "log", "message": "DSL execution complete", "level": "success"})


# ─────────────────────────────────────────────────────────────
# WEBSOCKET ENDPOINT
# ─────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def ws_endpoint_alias(websocket: WebSocket):
    await _handle_ws(websocket)


@app.websocket("/")
async def ws_root_endpoint(websocket: WebSocket):
    await _handle_ws(websocket)


async def _handle_ws(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    sess = DeviceSession(ws=websocket)
    sessions[session_id] = sess
    log.info(f"[{session_id}] Client connected")

    # Detect device on connect
    async def init_device():
        devices = await get_devices()
        if not devices:
            await websocket.send_json({
                "type": "device_status",
                "connected": False,
                "reason": "No authorized ADB device found. Run: adb devices",
            })
            return

        dev = devices[0]
        sess.udid = dev["id"]
        sess.model = dev["model"]
        sess.screen_w, sess.screen_h = await get_screen_size(sess.udid)
        sess.current_package = await get_foreground_package(sess.udid)

        await websocket.send_json({
            "type": "device_status",
            "connected": True,
            "id": sess.udid,
            "model": sess.model,
        })

        # Initial hierarchy
        xml = await dump_hierarchy(sess.udid)
        if xml:
            tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
            if tree:
                sess.hierarchy = tree
                await websocket.send_json({
                    "type": "state",
                    "hierarchy": tree,
                    "currentPackage": sess.current_package,
                    "deviceModel": sess.model,
                })

        # Start streamer
        sess.streamer_task = asyncio.create_task(stream_screen(session_id))

    asyncio.create_task(init_device())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            msg_type = msg.get("type")
            payload = msg.get("payload", {})

            # ── DEVICE ACTION ──
            if msg_type == "action":
                action = payload.get("action", "")
                udid = sess.udid
                if not udid:
                    continue

                locators = {}

                if action == "tap":
                    rx, ry = payload.get("ratioX", 0.5), payload.get("ratioY", 0.5)
                    await do_tap(udid, rx, ry, sess.screen_w, sess.screen_h)
                    if sess.hierarchy:
                        node = find_element_at(sess.hierarchy, rx, ry)
                        if node:
                            locators = build_locators(node)

                elif action == "swipe":
                    await do_swipe(
                        udid,
                        payload.get("ratioX1", 0.5), payload.get("ratioY1", 0.5),
                        payload.get("ratioX2", 0.5), payload.get("ratioY2", 0.7),
                        sess.screen_w, sess.screen_h,
                        payload.get("duration", 300),
                    )

                elif action == "longpress":
                    await do_long_press(
                        udid,
                        payload.get("ratioX", 0.5), payload.get("ratioY", 0.5),
                        sess.screen_w, sess.screen_h,
                        payload.get("duration", 1500),
                    )

                elif action == "doubletap":
                    await do_double_tap(
                        udid,
                        payload.get("ratioX", 0.5), payload.get("ratioY", 0.5),
                        sess.screen_w, sess.screen_h,
                    )

                elif action == "type":
                    await do_type(udid, payload.get("text", ""), payload.get("enter", False))

                elif action == "home":
                    await do_keyevent(udid, 3)

                elif action == "back":
                    await do_keyevent(udid, 4)

                elif action == "recents":
                    await do_keyevent(udid, 187)

                elif action == "rotate":
                    _, cur, _ = await adb_s("shell", "settings", "get", "system", "user_rotation", udid=udid, timeout=4)
                    cur_val = cur.decode(errors="replace").strip()
                    # Some devices return "null" or empty — treat as portrait (0)
                    new_val = "0" if cur_val in ("1",) else "1"
                    await adb_s("shell", "settings", "put", "system", "accelerometer_rotation", "0", udid=udid)
                    await asyncio.sleep(0.1)
                    await adb_s("shell", "settings", "put", "system", "user_rotation", new_val, udid=udid)
                    await asyncio.sleep(0.5)
                    await websocket.send_json({"type": "orientation", "landscape": new_val == "1"})

                elif action == "power":
                    await do_keyevent(udid, 26)

                elif action == "screenshot":
                    png = await screencap(udid)
                    if png:
                        b64 = base64.b64encode(png).decode()
                        await websocket.send_json({"type": "frame", "screenshot": b64, "afterAction": True})
                    continue

                elif action == "tap_by_id":
                    rid = payload.get("resourceId", "")
                    if rid:
                        await adb_s("shell", "input", "keyevent", "--longpress", "0", udid=udid)

                # Send action_done with locators
                await websocket.send_json({"type": "action_done", "locators": locators})

                # Capture fresh frame + refresh hierarchy in background
                asyncio.create_task(capture_after_action(session_id))
                asyncio.create_task(refresh_hierarchy_task(session_id))

            # ── REFRESH HIERARCHY ──
            elif msg_type == "refresh_hierarchy":
                if sess.udid:
                    xml = await dump_hierarchy(sess.udid)
                    if xml:
                        tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
                        if tree:
                            sess.hierarchy = tree
                            sess.hierarchy_stale = False
                            pkg = await get_foreground_package(sess.udid)
                            sess.current_package = pkg
                            await websocket.send_json({
                                "type": "state",
                                "hierarchy": tree,
                                "currentPackage": pkg,
                                "deviceModel": sess.model,
                            })
                    else:
                        await websocket.send_json({
                            "type": "state",
                            "hierarchy": sess.hierarchy,
                            "stale": True,
                            "currentPackage": sess.current_package,
                            "deviceModel": sess.model,
                        })

            # ── RUN APPIUM SCRIPT ──
            elif msg_type == "run_appium_script":
                script = payload.get("script", "")
                language = payload.get("language", "python")
                if script.strip():
                    asyncio.create_task(run_script(session_id, script, language))

            # ── RUN DSL SCRIPT ──
            elif msg_type == "run_manual_script":
                lines = payload.get("lines", [])
                if lines:
                    asyncio.create_task(run_dsl(session_id, lines))

            # ── STOP SCRIPT ──
            elif msg_type == "stop_script":
                if sess.runner_proc:
                    try:
                        sess.runner_proc.kill()
                    except Exception:
                        pass
                    sess.runner_proc = None
                    await websocket.send_json({"type": "log", "message": "Script stopped by user", "level": "warn"})

            # ── SAVE RECORDING ──
            elif msg_type == "save_local_recording":
                name = payload.get("name", f"recording_{int(time.time())}")
                actions = payload.get("actions", [])
                os.makedirs("recordings", exist_ok=True)
                safe_name = re.sub(r"[^\w\-]", "_", name)
                path = f"recordings/{safe_name}.json"
                with open(path, "w", encoding="utf-8") as f:
                    json.dump({
                        "name": name,
                        "device": sess.model,
                        "udid": sess.udid,
                        "package": sess.current_package,
                        "platform": "ANDROID",
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "actions": actions,
                    }, f, indent=2)
                await websocket.send_json({"type": "recording_saved", "path": path})

    except WebSocketDisconnect:
        log.info(f"[{session_id}] Client disconnected")
    except Exception as e:
        log.error(f"[{session_id}] WS error: {e}")
    finally:
        if sess.streamer_task:
            sess.streamer_task.cancel()
        if sess.runner_proc:
            try:
                sess.runner_proc.kill()
            except Exception:
                pass
        sessions.pop(session_id, None)


@app.get("/health")
async def health():
    devices = await get_devices()
    return {"status": "ok", "devices": devices, "sessions": len(sessions)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8767, log_level="info")
