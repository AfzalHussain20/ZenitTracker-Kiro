"""
Zenit Vision — Real ADB WebSocket Server
Port: 8767
"""

import asyncio
import base64
import hashlib
import io
import json
import logging
import os
import re
import tempfile
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional

try:
    from PIL import Image
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False
    log_tmp = logging.getLogger("vision")
    log_tmp.warning("Pillow not installed — JPEG compression disabled. Run: pip install pillow")

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("vision")

app = FastAPI(title="Zenit Vision Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── ADB BRIDGE ──────────────────────────────────────────────

async def adb(*args, timeout=10) -> tuple[int, bytes, bytes]:
    cmd = ["adb"] + list(args)
    try:
        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return proc.returncode, stdout, stderr
    except asyncio.TimeoutError:
        try: proc.kill()
        except Exception: pass
        return -1, b"", b"timeout"
    except FileNotFoundError:
        return -1, b"", b"adb not found"

async def adb_s(*args, udid: str, timeout=10) -> tuple[int, bytes, bytes]:
    return await adb("-s", udid, *args, timeout=timeout)

async def get_devices() -> list[dict]:
    rc, out, _ = await adb("devices", "-l")
    if rc != 0: return []
    devices = []
    for line in out.decode(errors="replace").splitlines()[1:]:
        line = line.strip()
        if not line or "offline" in line or "unauthorized" in line: continue
        parts = line.split()
        if len(parts) < 2 or parts[1] != "device": continue
        udid = parts[0]
        model = next((p[6:].replace("_", " ") for p in parts[2:] if p.startswith("model:")), "")
        if not model:
            _, mout, _ = await adb_s("shell", "getprop", "ro.product.model", udid=udid, timeout=5)
            model = mout.decode(errors="replace").strip() or udid
        devices.append({"id": udid, "model": model})
    return devices

async def get_foreground_package(udid: str) -> str:
    _, out, _ = await adb_s("shell", "dumpsys", "window", "windows", udid=udid, timeout=8)
    text = out.decode(errors="replace")
    m = re.search(r"mCurrentFocus=Window\{[^}]+\s+([\w.]+)/", text)
    if m: return m.group(1)
    m = re.search(r"mFocusedApp=.*ActivityRecord\{[^}]+\s+([\w.]+)/", text)
    return m.group(1) if m else ""

async def screencap(udid: str) -> Optional[bytes]:
    rc, out, _ = await adb_s("exec-out", "screencap", "-p", udid=udid, timeout=8)
    if rc == 0 and len(out) > 100:
        # Strip any leading CRLF garbage (some devices prepend \r\n before PNG header)
        idx = out.find(b'\x89PNG')
        if idx != -1:
            return out[idx:]
    # Fallback: shell screencap to file then pull
    tmp_device = "/sdcard/sc_tmp.png"
    local_path = os.path.join(tempfile.gettempdir(), f"sc_{udid.replace(':', '_')}.png")
    await adb_s("shell", "screencap", "-p", tmp_device, udid=udid, timeout=8)
    rc2, _, _ = await adb_s("pull", tmp_device, local_path, udid=udid, timeout=8)
    if rc2 == 0:
        try:
            with open(local_path, "rb") as f: return f.read()
        except Exception: pass
    return None

async def get_screen_size(udid: str) -> tuple[int, int]:
    _, out, _ = await adb_s("shell", "wm", "size", udid=udid, timeout=5)
    m = re.search(r"(\d+)x(\d+)", out.decode(errors="replace"))
    return (int(m.group(1)), int(m.group(2))) if m else (1080, 1920)

async def dump_hierarchy(udid: str) -> Optional[str]:
    local_path = os.path.join(tempfile.gettempdir(), f"window_dump_{udid.replace(':', '_')}.xml")
    await adb_s("shell", "uiautomator", "dump", "/sdcard/window_dump.xml", udid=udid, timeout=8)
    rc, _, _ = await adb_s("pull", "/sdcard/window_dump.xml", local_path, udid=udid, timeout=8)
    if rc != 0: return None
    try:
        with open(local_path, "r", encoding="utf-8", errors="replace") as f: return f.read()
    except Exception: return None

# ── HIERARCHY PARSER ────────────────────────────────────────

def parse_bounds(bounds_str: str, w: int, h: int) -> dict:
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds_str or "")
    if not m: return {"x": 0, "y": 0, "width": 0, "height": 0}
    x1, y1, x2, y2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return {"x": round(x1/w,4), "y": round(y1/h,4), "width": round((x2-x1)/w,4), "height": round((y2-y1)/h,4)}

def normalize_node(elem: ET.Element, w: int, h: int, idx: int = 0) -> dict:
    a = elem.attrib
    class_name = a.get("class", "")
    resource_id = a.get("resource-id", "")
    content_desc = a.get("content-desc", "")
    text = a.get("text", "")
    bounds = parse_bounds(a.get("bounds", ""), w, h)
    if resource_id:
        node_id = resource_id
    else:
        raw = f"{class_name}_{idx}_{bounds['x']:.4f}_{bounds['y']:.4f}_{bounds['width']:.4f}"
        node_id = hashlib.md5(raw.encode()).hexdigest()[:12]
    children = [normalize_node(child, w, h, i) for i, child in enumerate(elem)]
    return {
        "id": node_id, "type": class_name,
        "name": content_desc or text or (class_name.split(".")[-1] if class_name else "View"),
        "attributes": {
            "resourceId": resource_id, "contentDesc": content_desc, "text": text,
            "bounds": bounds, "clickable": a.get("clickable") == "true",
            "enabled": a.get("enabled") == "true", "scrollable": a.get("scrollable") == "true",
            "focusable": a.get("focusable") == "true", "selected": a.get("selected") == "true",
            "index": int(a.get("index", idx)),
        },
        "children": children,
    }

def parse_hierarchy_xml(xml_str: str, w: int, h: int) -> Optional[dict]:
    try:
        root = ET.fromstring(xml_str)
        if root.tag == "hierarchy":
            children = list(root)
            if children: return normalize_node(children[0], w, h)
        return normalize_node(root, w, h)
    except Exception as e:
        log.error(f"Hierarchy parse error: {e}")
        return None

# ── SESSION STATE ────────────────────────────────────────────

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
    logcat_task: Optional[asyncio.Task] = None
    logcat_proc: Optional[asyncio.subprocess.Process] = None
    ws: Optional[WebSocket] = None

sessions: dict[str, DeviceSession] = {}

# ── SCREEN STREAMER ──────────────────────────────────────────

def _png_to_jpeg(png_bytes: bytes, quality: int = 65, scale: float = 1.0) -> bytes:
    """Convert PNG bytes to JPEG. Falls back to original PNG if PIL unavailable."""
    if not _PIL_AVAILABLE:
        return png_bytes
    try:
        img = Image.open(io.BytesIO(png_bytes))
        if scale < 1.0:
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=quality, optimize=True)
        return buf.getvalue()
    except Exception:
        return png_bytes

async def stream_screen(session_id: str):
    sess = sessions.get(session_id)
    if not sess: return
    log.info(f"[{session_id}] Streamer started for {sess.udid}")
    # WiFi = IP:port format — use JPEG + scale down for speed
    is_wifi = ':' in sess.udid
    quality = 55 if is_wifi else 72
    scale   = 0.67 if is_wifi else 1.0   # ~720p on WiFi, full res on USB
    target_interval = 0.05               # aim for 20fps, adaptive sleep
    fail_count = 0
    while session_id in sessions and sessions[session_id].ws:
        t_start = time.time()
        try:
            png = await screencap(sess.udid)
            if png:
                fail_count = 0
                img_bytes = _png_to_jpeg(png, quality=quality, scale=scale)
                b64 = base64.b64encode(img_bytes).decode()
                await sess.ws.send_json({
                    "type": "frame", "screenshot": b64, "afterAction": False,
                    "width": sess.screen_w, "height": sess.screen_h,
                })
            else:
                fail_count += 1
                if fail_count > 5: log.warning(f"[{session_id}] Screencap failing")
                await asyncio.sleep(0.5)
                continue
            elapsed = time.time() - t_start
            await asyncio.sleep(max(0, target_interval - elapsed))
        except Exception as e:
            log.error(f"[{session_id}] Streamer error: {e}")
            await asyncio.sleep(0.5)

async def capture_after_action(session_id: str):
    """Deprecated — use capture_then_refresh instead."""
    pass

async def capture_then_refresh(session_id: str):
    """Capture screenshot at 0.6s, then refresh hierarchy at 1.2s (sequenced, not parallel)."""
    await asyncio.sleep(0.6)
    sess = sessions.get(session_id)
    if not sess or not sess.ws: return
    try:
        png = await screencap(sess.udid)
        if png:
            is_wifi = ':' in sess.udid
            img_bytes = _png_to_jpeg(png, quality=55 if is_wifi else 72, scale=0.67 if is_wifi else 1.0)
            b64 = base64.b64encode(img_bytes).decode()
            await sess.ws.send_json({"type": "frame", "screenshot": b64, "afterAction": True, "width": sess.screen_w, "height": sess.screen_h})
    except Exception: pass
    # Hierarchy refresh after screenshot settles
    await asyncio.sleep(0.6)
    await refresh_hierarchy_task(session_id)

async def refresh_hierarchy_task(session_id: str):
    await asyncio.sleep(0.5)
    sess = sessions.get(session_id)
    if not sess or not sess.ws: return
    try:
        sess.screen_w, sess.screen_h = await get_screen_size(sess.udid)
        xml = await dump_hierarchy(sess.udid)
        if xml:
            tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
            if tree:
                sess.hierarchy = tree
                sess.hierarchy_stale = False
                pkg = await get_foreground_package(sess.udid)
                sess.current_package = pkg
                await sess.ws.send_json({"type": "state", "hierarchy": tree, "currentPackage": pkg, "deviceModel": sess.model, "screenWidth": sess.screen_w, "screenHeight": sess.screen_h})
    except Exception as e:
        log.error(f"[{session_id}] Hierarchy refresh error: {e}")

# ── DEVICE ACTIONS ───────────────────────────────────────────

async def do_tap(udid, rx, ry, w, h):
    await adb_s("shell", "input", "tap", str(int(rx*w)), str(int(ry*h)), udid=udid)

async def do_swipe(udid, rx1, ry1, rx2, ry2, w, h, duration_ms=300):
    await adb_s("shell", "input", "swipe", str(int(rx1*w)), str(int(ry1*h)), str(int(rx2*w)), str(int(ry2*h)), str(duration_ms), udid=udid)

async def do_long_press(udid, rx, ry, w, h, duration_ms=1500):
    x, y = str(int(rx*w)), str(int(ry*h))
    await adb_s("shell", "input", "swipe", x, y, x, y, str(duration_ms), udid=udid)

async def do_double_tap(udid, rx, ry, w, h):
    x, y = str(int(rx*w)), str(int(ry*h))
    await adb_s("shell", "input", "tap", x, y, udid=udid)
    await asyncio.sleep(0.18)
    await adb_s("shell", "input", "tap", x, y, udid=udid)

async def do_type(udid: str, text: str, enter: bool = False):
    """Type text via ADB. No shell involved — only Android %s encoding needed."""
    if not text: return
    is_ascii = all(0x20 <= ord(c) <= 0x7E for c in text)
    if is_ascii:
        encoded = text.replace("%", "%%").replace(" ", "%s")
        await adb_s("shell", "input", "text", encoded, udid=udid)
    else:
        rc, _, _ = await adb_s("shell", "am", "broadcast", "-a", "ADB_INPUT_TEXT", "--es", "msg", text, udid=udid, timeout=8)
        if rc != 0:
            log.warning(f"[do_type] ADBKeyboard broadcast failed (rc={rc}) — falling back to char-by-char. Install ADBKeyboard for full Unicode support.")
            for char in text:
                if char == ' ':
                    await adb_s("shell", "input", "text", "%s", udid=udid)
                elif 0x21 <= ord(char) <= 0x7E:
                    await adb_s("shell", "input", "text", char.replace("%", "%%"), udid=udid)
    if enter:
        await adb_s("shell", "input", "keyevent", "66", udid=udid)

async def do_keyevent(udid: str, keycode: int):
    await adb_s("shell", "input", "keyevent", str(keycode), udid=udid)

def find_element_at(node: dict, rx: float, ry: float) -> Optional[dict]:
    if not node: return None
    b = node.get("attributes", {}).get("bounds", {})
    if not b: return None
    if rx < b["x"] or rx > b["x"]+b["width"] or ry < b["y"] or ry > b["y"]+b["height"]: return None
    for child in node.get("children", []):
        hit = find_element_at(child, rx, ry)
        if hit: return hit
    return node

def build_locators(node: dict) -> dict:
    if not node: return {}
    a = node.get("attributes", {})
    rid, cd, txt = a.get("resourceId",""), a.get("contentDesc",""), a.get("text","")
    cls = node.get("type","").split(".")[-1] or "*"
    if rid: xpath = f"//{cls}[@resource-id='{rid}']"
    elif cd: xpath = f"//{cls}[@content-desc='{cd}']"
    elif txt: xpath = f"//{cls}[@text='{txt}']"
    else: xpath = f"//{cls}"
    return {"resourceId": rid, "accessibilityId": cd, "text": txt, "className": node.get("type",""), "xpath": xpath}

def build_locator_chain(node: dict, root: dict) -> dict:
    if not node: return {}
    a = node.get("attributes", {})
    rid, cd, txt = a.get("resourceId",""), a.get("contentDesc",""), a.get("text","")
    cls = node.get("type","").split(".")[-1] or "*"
    if rid: return {"resourceId": rid, "accessibilityId": cd, "text": txt, "xpath": f"//{cls}[@resource-id='{rid}']", "best": "resourceId"}
    if cd: return {"resourceId": "", "accessibilityId": cd, "text": txt, "xpath": f"//{cls}[@content-desc='{cd}']", "best": "accessibilityId"}
    if txt: return {"resourceId": "", "accessibilityId": "", "text": txt, "xpath": f"//{cls}[@text='{txt}']", "best": "text"}
    return {"resourceId": "", "accessibilityId": "", "text": "", "xpath": f"//{cls}", "best": "xpath"}

# ── WIFI IP DETECTION ────────────────────────────────────────

def _detect_ip(text: str) -> str:
    for pat in [r'inet\s+([\d.]+)/', r'src\s+([\d.]+)', r'inet\s+addr:([\d.]+)', r'inet\s+([\d.]+)']:
        m = re.search(pat, text)
        if m and not m.group(1).startswith("127.") and not m.group(1).startswith("0."):
            return m.group(1)
    s = text.strip()
    if re.match(r'^\d+\.\d+\.\d+\.\d+$', s) and not s.startswith("127."): return s
    return ""

async def _get_device_ip(udid: str) -> str:
    for args in [
        ("shell", "ip", "addr", "show", "wlan0"),
        ("shell", "ip", "route"),
        ("shell", "ifconfig", "wlan0"),
        ("shell", "getprop", "dhcp.wlan0.ipaddress"),
    ]:
        _, out, _ = await adb_s(*args, udid=udid, timeout=4)
        ip = _detect_ip(out.decode(errors="replace"))
        if ip: return ip
    return ""

# ── NATIVE STEP RUNNER ───────────────────────────────────────

async def run_native_steps(session_id: str, steps: list):
    sess = sessions.get(session_id)
    if not sess or not sess.ws: return
    udid = sess.udid
    total = len(steps)
    passed = failed = 0

    async def log_msg(msg: str, level: str = "info"):
        try: await sess.ws.send_json({"type": "log", "message": msg, "level": level})
        except Exception: pass

    async def step_result(idx, step_id, ok, detail):
        try: await sess.ws.send_json({"type": "native_step_result", "index": idx, "stepId": step_id, "passed": ok, "detail": detail})
        except Exception: pass

    def find_node(hierarchy, locator):
        rid, cd, txt, xp = locator.get("resourceId",""), locator.get("accessibilityId",""), locator.get("text",""), locator.get("xpath","")
        def search(node, key, val):
            if not node: return None
            if node.get("attributes",{}).get(key) == val: return node
            for c in node.get("children",[]):
                r = search(c, key, val)
                if r: return r
            return None
        if rid:
            n = search(hierarchy, "resourceId", rid)
            if n: return n
        if cd:
            n = search(hierarchy, "contentDesc", cd)
            if n: return n
        if txt:
            n = search(hierarchy, "text", txt)
            if n: return n
        if xp:
            # Attribute-based: //Class[@attr='val']
            m = re.search(r"\[@(resource-id|text|content-desc)='([^']+)'\]", xp)
            if m:
                ak = {"resource-id":"resourceId","text":"text","content-desc":"contentDesc"}.get(m.group(1), m.group(1))
                n = search(hierarchy, ak, m.group(2))
                if n: return n
            # Index-based fallback: //ClassName[N] — collect all nodes of that class, pick by 1-based index
            m2 = re.match(r"//([A-Za-z0-9_.]+)\[(\d+)\]$", xp.strip())
            if m2:
                cls_name = m2.group(1)
                idx = int(m2.group(2)) - 1  # convert to 0-based
                matches = []
                def collect_by_class(node):
                    if not node: return
                    short = node.get("type","").split(".")[-1]
                    if short == cls_name or node.get("type","") == cls_name:
                        matches.append(node)
                    for c in node.get("children",[]):
                        collect_by_class(c)
                collect_by_class(hierarchy)
                if 0 <= idx < len(matches):
                    return matches[idx]
        return None

    async def find_with_retry(locator, retries=3):
        for attempt in range(retries):
            node = find_node(sess.hierarchy, locator) if sess.hierarchy else None
            if node: return node
            if attempt < retries - 1:
                sess.screen_w, sess.screen_h = await get_screen_size(udid)
                xml = await dump_hierarchy(udid)
                if xml:
                    tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
                    if tree: sess.hierarchy = tree
                await asyncio.sleep(1.0)
        return None

    await log_msg(f"▶  Native runner — {total} step(s)", "info")
    await log_msg(f"   Device: {sess.model}  Package: {sess.current_package}", "info")
    try: await sess.ws.send_json({"type": "native_run_start", "total": total})
    except Exception: pass

    for i, step in enumerate(steps):
        step_id = step.get("id", str(i))
        t = step.get("type","").upper()
        locator = step.get("locator", {})
        value = step.get("value","")
        desc = step.get("description", t)
        await log_msg(f"  [{i+1}/{total}] {desc}", "info")
        try:
            # Always refresh hierarchy before each step — screen may have changed
            sess.screen_w, sess.screen_h = await get_screen_size(udid)
            xml = await dump_hierarchy(udid)
            if xml:
                tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
                if tree: sess.hierarchy = tree

            if t in ("CLICK","TAP"):
                node = await find_with_retry(locator)
                if not node: raise Exception(f"Element not found — {locator.get('resourceId') or locator.get('text') or 'no locator'}")
                b = node["attributes"]["bounds"]
                await do_tap(udid, b["x"] + b["width"]/2, b["y"] + b["height"]/2, sess.screen_w, sess.screen_h)
                await asyncio.sleep(0.8)
            elif t == "TYPE":
                node = await find_with_retry(locator)
                if node:
                    b = node["attributes"]["bounds"]
                    await do_tap(udid, b["x"] + b["width"]/2, b["y"] + b["height"]/2, sess.screen_w, sess.screen_h)
                    await asyncio.sleep(0.5)
                    # Clear field: move to end, then long-press DEL to clear backwards
                    await adb_s("shell", "input", "keyevent", "123", udid=udid)  # KEYCODE_MOVE_END
                    await asyncio.sleep(0.1)
                    await adb_s("shell", "input", "keyevent", "--longpress", "67", udid=udid)  # long DEL
                    await asyncio.sleep(0.2)
                await do_type(udid, value or "", False)
                await asyncio.sleep(0.5)
            elif t in ("SWIPE_UP","SCROLL_UP"): await do_swipe(udid,0.5,0.7,0.5,0.3,sess.screen_w,sess.screen_h,400); await asyncio.sleep(0.5)
            elif t in ("SWIPE_DOWN","SCROLL_DOWN"): await do_swipe(udid,0.5,0.3,0.5,0.7,sess.screen_w,sess.screen_h,400); await asyncio.sleep(0.5)
            elif t == "SWIPE_LEFT": await do_swipe(udid,0.8,0.5,0.2,0.5,sess.screen_w,sess.screen_h,400); await asyncio.sleep(0.5)
            elif t == "SWIPE_RIGHT": await do_swipe(udid,0.2,0.5,0.8,0.5,sess.screen_w,sess.screen_h,400); await asyncio.sleep(0.5)
            elif t == "LONG_PRESS":
                node = await find_with_retry(locator)
                if not node: raise Exception("Element not found for long press")
                b = node.get("attributes",{}).get("bounds",{})
                await do_long_press(udid, b.get("x",0.5)+b.get("width",0)/2, b.get("y",0.5)+b.get("height",0)/2, sess.screen_w, sess.screen_h)
                await asyncio.sleep(0.8)
            elif t == "HOME": await do_keyevent(udid, 3); await asyncio.sleep(0.8)
            elif t == "BACK": await do_keyevent(udid, 4); await asyncio.sleep(0.5)
            elif t == "WAIT":
                secs = float(value) if value else 2.0
                await log_msg(f"     ⏱ Waiting {secs}s…", "info")
                await asyncio.sleep(secs)
            else:
                await log_msg(f"     ⚠ Skipped: {t}", "warn")
                await step_result(i, step_id, True, f"Skipped: {t}")
                continue
            xml = await dump_hierarchy(udid)
            if xml:
                tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
                if tree: sess.hierarchy = tree
            passed += 1
            await log_msg(f"     ✓ Passed", "success")
            await step_result(i, step_id, True, "OK")
        except Exception as e:
            failed += 1
            await log_msg(f"     ✗ Failed: {e}", "error")
            await step_result(i, step_id, False, str(e))

    await log_msg("", "info")
    if failed == 0: await log_msg(f"✅  All {total} steps passed", "success")
    else: await log_msg(f"❌  {passed}/{total} passed, {failed} failed", "error")
    try: await sess.ws.send_json({"type": "native_run_done", "total": total, "passed": passed, "failed": failed})
    except Exception: pass

# ── LOGCAT STREAMER ──────────────────────────────────────────

async def stream_logcat(session_id: str, package: str):
    sess = sessions.get(session_id)
    if not sess or not sess.ws: return
    async def send(line):
        try: await sess.ws.send_json({"type": "logcat_line", "line": line})
        except Exception: pass
    await adb_s("logcat", "-c", udid=sess.udid, timeout=5)
    cmd = ["adb", "-s", sess.udid, "logcat", "-v", "time"]
    try:
        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        sess.logcat_proc = proc
        await sess.ws.send_json({"type": "logcat_status", "running": True})
        while session_id in sessions and sessions[session_id].ws:
            try:
                line = await asyncio.wait_for(proc.stdout.readline(), timeout=2.0)
                if not line: break
                decoded = line.decode(errors="replace").rstrip()
                if decoded:
                    if package and package not in decoded:
                        keep_kw = ["FATAL","ANR","crash","DRM","Widevine","MediaDrm","clearkey","SIGSEGV"," E "," E/","Exception","Error"]
                        if not any(kw in decoded for kw in keep_kw): continue
                    await send(decoded)
            except asyncio.TimeoutError: continue
            except Exception: break
    except Exception as e:
        log.error(f"[{session_id}] Logcat error: {e}")
    finally:
        if sess.logcat_proc:
            try: sess.logcat_proc.kill()
            except Exception: pass
            sess.logcat_proc = None
        try: await sess.ws.send_json({"type": "logcat_status", "running": False})
        except Exception: pass

# ── SCRIPT RUNNER ────────────────────────────────────────────

async def run_script(session_id: str, script: str, language: str):
    sess = sessions.get(session_id)
    if not sess or not sess.ws: return
    ext = ".py" if language == "python" else ".js"

    # Detect interpreter
    interpreter = "python3"
    try:
        chk = await asyncio.create_subprocess_exec("python3", "--version", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        await asyncio.wait_for(chk.communicate(), timeout=5)
        if chk.returncode != 0: interpreter = "python"
    except (FileNotFoundError, asyncio.TimeoutError):
        interpreter = "python"
    if language != "python": interpreter = "node"

    with tempfile.NamedTemporaryFile(mode="w", suffix=ext, delete=False, encoding="utf-8") as f:
        f.write(script); tmp_path = f.name

    async def send_log(msg, level="info"):
        try: await sess.ws.send_json({"type": "log", "message": msg, "level": level})
        except Exception: pass

    # Pre-flight: check required packages for Python Appium scripts
    if language == "python" and "from appium" in script:
        check_code = "import appium; import selenium; print('OK')"
        try:
            chk = await asyncio.create_subprocess_exec(
                interpreter, "-c", check_code,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            out, err = await asyncio.wait_for(chk.communicate(), timeout=8)
            if chk.returncode != 0:
                await send_log("❌  Missing Python packages. Install them first:", "error")
                await send_log(f"   {interpreter} -m pip install Appium-Python-Client selenium", "warn")
                await send_log("", "info")
                await send_log("💡  Tip: Use the green Run button in the Recorder tab instead —", "info")
                await send_log("   it runs your recorded steps directly via ADB (no Appium needed).", "info")
                return
        except Exception:
            pass

    await send_log(f"▶  Starting {language} script… (interpreter: {interpreter})", "info")
    try:
        proc = await asyncio.create_subprocess_exec(interpreter, tmp_path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        sess.runner_proc = proc
        async def read_stream(stream, level):
            while True:
                line = await stream.readline()
                if not line: break
                decoded = line.decode(errors="replace").rstrip()
                # Intercept ModuleNotFoundError and give helpful message
                if "ModuleNotFoundError: No module named" in decoded:
                    module = decoded.split("'")[1] if "'" in decoded else "unknown"
                    await send_log(f"❌  Missing module: {module}", "error")
                    if module in ("appium", "selenium"):
                        await send_log(f"   Fix: {interpreter} -m pip install Appium-Python-Client selenium", "warn")
                        await send_log("", "info")
                        await send_log("💡  Or use the Recorder tab → green Run button (no Appium needed)", "info")
                    else:
                        await send_log(f"   Fix: {interpreter} -m pip install {module}", "warn")
                else:
                    await send_log(decoded, level)
        try:
            await asyncio.wait_for(asyncio.gather(read_stream(proc.stdout,"info"), read_stream(proc.stderr,"error"), proc.wait()), timeout=300)
        except asyncio.TimeoutError:
            proc.kill(); await send_log("Timed out after 300s", "error"); return
        if proc.returncode == 0: await send_log("Script completed successfully", "success")
        else: await send_log(f"Script failed with exit code {proc.returncode}", "error")
    except FileNotFoundError:
        await send_log(f"Interpreter '{interpreter}' not found. Install Python first.", "error")
    except Exception as e:
        await send_log(f"Runner error: {e}", "error")
    finally:
        sess.runner_proc = None
        try: os.unlink(tmp_path)
        except Exception: pass

async def run_dsl(session_id: str, lines: list[str]):
    sess = sessions.get(session_id)
    if not sess or not sess.ws: return
    async def send_log(msg, level="info"):
        try: await sess.ws.send_json({"type": "log", "message": msg, "level": level})
        except Exception: pass
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"): continue
        parts = line.split(None, 1); cmd = parts[0].lower(); args = parts[1] if len(parts) > 1 else ""
        await send_log(f"$ {line}", "info")
        try:
            if cmd == "tap":
                xy = args.split()
                if len(xy) >= 2: await adb_s("shell", "input", "tap", xy[0], xy[1], udid=sess.udid)
            elif cmd == "type": await do_type(sess.udid, args)
            elif cmd == "swipe":
                xy = args.split()
                if len(xy) >= 4:
                    dur = xy[4] if len(xy) > 4 else "300"
                    await adb_s("shell", "input", "swipe", xy[0], xy[1], xy[2], xy[3], dur, udid=sess.udid)
            elif cmd == "home": await do_keyevent(sess.udid, 3)
            elif cmd == "back": await do_keyevent(sess.udid, 4)
            elif cmd == "wait": await asyncio.sleep(float(args) if args else 1.0)
            else: await send_log(f"Unknown command: {cmd}", "warn")
        except Exception as e:
            await send_log(f"Error: {e}", "error")
    await sess.ws.send_json({"type": "log", "message": "DSL complete", "level": "success"})

# ── WEBSOCKET ENDPOINT ───────────────────────────────────────

@app.websocket("/ws")
async def ws_endpoint_alias(websocket: WebSocket): await _handle_ws(websocket)

@app.websocket("/")
async def ws_root_endpoint(websocket: WebSocket): await _handle_ws(websocket)

async def _handle_ws(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    sess = DeviceSession(ws=websocket)
    sessions[session_id] = sess
    log.info(f"[{session_id}] Client connected")

    async def init_device():
        devices = await get_devices()
        if not devices:
            await websocket.send_json({"type": "device_status", "connected": False, "reason": "No authorized ADB device. Run: adb devices"})
            return
        dev = devices[0]
        sess.udid = dev["id"]; sess.model = dev["model"]
        sess.screen_w, sess.screen_h = await get_screen_size(sess.udid)
        sess.current_package = await get_foreground_package(sess.udid)
        await websocket.send_json({"type": "device_status", "connected": True, "id": sess.udid, "model": sess.model})
        xml = await dump_hierarchy(sess.udid)
        if xml:
            tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
            if tree:
                sess.hierarchy = tree
                await websocket.send_json({"type": "state", "hierarchy": tree, "currentPackage": sess.current_package, "deviceModel": sess.model, "screenWidth": sess.screen_w, "screenHeight": sess.screen_h})
        sess.streamer_task = asyncio.create_task(stream_screen(session_id))

    asyncio.create_task(init_device())

    try:
        while True:
            raw = await websocket.receive_text()
            try: msg = json.loads(raw)
            except Exception: continue
            msg_type = msg.get("type")
            payload = msg.get("payload", {})

            if msg_type == "action":
                action = payload.get("action", "")
                udid = sess.udid
                if not udid: continue
                locators = {}

                if action == "tap":
                    rx, ry = payload.get("ratioX", 0.5), payload.get("ratioY", 0.5)
                    await do_tap(udid, rx, ry, sess.screen_w, sess.screen_h)
                    if sess.hierarchy:
                        node = find_element_at(sess.hierarchy, rx, ry)
                        if node: locators = build_locator_chain(node, sess.hierarchy)
                elif action == "swipe":
                    await do_swipe(udid, payload.get("ratioX1",0.5), payload.get("ratioY1",0.5), payload.get("ratioX2",0.5), payload.get("ratioY2",0.7), sess.screen_w, sess.screen_h, payload.get("duration",300))
                elif action == "longpress":
                    await do_long_press(udid, payload.get("ratioX",0.5), payload.get("ratioY",0.5), sess.screen_w, sess.screen_h, payload.get("duration",1500))
                elif action == "doubletap":
                    await do_double_tap(udid, payload.get("ratioX",0.5), payload.get("ratioY",0.5), sess.screen_w, sess.screen_h)
                elif action == "type":
                    await do_type(udid, payload.get("text",""), payload.get("enter",False))
                elif action == "home": await do_keyevent(udid, 3)
                elif action == "back": await do_keyevent(udid, 4)
                elif action == "recents": await do_keyevent(udid, 187)
                elif action == "rotate":
                    _, cur, _ = await adb_s("shell", "dumpsys", "SurfaceFlinger", udid=udid, timeout=5)
                    text_sf = cur.decode(errors="replace")
                    is_landscape = "orientation=1" in text_sf or "orientation=3" in text_sf
                    new_val = "0" if is_landscape else "1"
                    await adb_s("shell", "settings", "put", "system", "accelerometer_rotation", "0", udid=udid)
                    await adb_s("shell", "settings", "put", "system", "user_rotation", new_val, udid=udid)
                    await asyncio.sleep(0.8)
                    _, check, _ = await adb_s("shell", "settings", "get", "system", "user_rotation", udid=udid, timeout=4)
                    confirmed_landscape = check.decode(errors="replace").strip() == "1"
                    await websocket.send_json({"type": "orientation", "landscape": confirmed_landscape})
                elif action == "power": await do_keyevent(udid, 26)
                elif action == "screenshot":
                    png = await screencap(udid)
                    if png:
                        img_bytes = _png_to_jpeg(png, quality=72)
                        b64 = base64.b64encode(img_bytes).decode()
                        await websocket.send_json({"type": "frame", "screenshot": b64, "afterAction": True, "width": sess.screen_w, "height": sess.screen_h})
                    continue
                elif action == "tap_by_id":
                    rid = payload.get("resourceId","")
                    if rid and sess.hierarchy:
                        def find_by_rid(node, target):
                            if not node: return None
                            if node.get("attributes",{}).get("resourceId") == target: return node
                            for c in node.get("children",[]):
                                r = find_by_rid(c, target)
                                if r: return r
                            return None
                        el = find_by_rid(sess.hierarchy, rid)
                        if el:
                            b = el.get("attributes",{}).get("bounds",{})
                            await do_tap(udid, b.get("x",0.5)+b.get("width",0)/2, b.get("y",0.5)+b.get("height",0)/2, sess.screen_w, sess.screen_h)
                            locators = build_locator_chain(el, sess.hierarchy)
                elif action == "type_into":
                    await do_type(udid, payload.get("text",""), False)
                elif action == "clear_field":
                    await adb_s("shell", "input", "keyevent", "123", udid=udid)
                    await adb_s("shell", "input", "keyevent", "--longpress", "67", udid=udid)
                elif action in ("assert_visible","assert_text","assert_enabled"):
                    xpath = payload.get("xpath",""); expected = payload.get("expected","")
                    el = None
                    if sess.hierarchy and xpath:
                        m = re.search(r"\[@(resource-id|text|content-desc)='([^']+)'\]", xpath)
                        if m:
                            ak = {"resource-id":"resourceId","text":"text","content-desc":"contentDesc"}.get(m.group(1), m.group(1))
                            av = m.group(2)
                            def _find(node, ak, av):
                                if not node: return None
                                if node.get("attributes",{}).get(ak) == av: return node
                                for c in node.get("children",[]):
                                    r = _find(c, ak, av)
                                    if r: return r
                                return None
                            el = _find(sess.hierarchy, ak, av)
                    if action == "assert_visible":
                        passed = el is not None; message = f"assert_visible: {'found' if passed else 'NOT found'} — {xpath}"
                    elif action == "assert_text":
                        actual = el.get("attributes",{}).get("text","") if el else ""
                        passed = actual == expected; message = f"assert_text: expected='{expected}' actual='{actual}' — {'PASS' if passed else 'FAIL'}"
                    else:
                        passed = el.get("attributes",{}).get("enabled",False) if el else False
                        message = f"assert_enabled: {'enabled' if passed else 'NOT enabled'} — {xpath}"
                    await websocket.send_json({"type": "assertionResult", "passed": passed, "message": message, "action": action})
                    asyncio.create_task(capture_then_refresh(session_id))
                    continue

                await websocket.send_json({"type": "action_done", "locators": locators})
                asyncio.create_task(capture_then_refresh(session_id))

            elif msg_type == "refresh_hierarchy":
                if sess.udid:
                    xml = await dump_hierarchy(sess.udid)
                    if xml:
                        tree = parse_hierarchy_xml(xml, sess.screen_w, sess.screen_h)
                        if tree:
                            sess.hierarchy = tree; sess.hierarchy_stale = False
                            pkg = await get_foreground_package(sess.udid); sess.current_package = pkg
                            await websocket.send_json({"type": "state", "hierarchy": tree, "currentPackage": pkg, "deviceModel": sess.model, "screenWidth": sess.screen_w, "screenHeight": sess.screen_h})
                    else:
                        await websocket.send_json({"type": "state", "hierarchy": sess.hierarchy, "stale": True, "currentPackage": sess.current_package, "deviceModel": sess.model})

            elif msg_type == "run_appium_script":
                script = payload.get("script",""); language = payload.get("language","python")
                if script.strip(): asyncio.create_task(run_script(session_id, script, language))
            elif msg_type == "run_manual_script":
                lines = payload.get("lines",[])
                if lines: asyncio.create_task(run_dsl(session_id, lines))
            elif msg_type == "stop_script":
                if sess.runner_proc:
                    try: sess.runner_proc.kill()
                    except Exception: pass
                    sess.runner_proc = None
                    await websocket.send_json({"type": "log", "message": "Script stopped by user", "level": "warn"})
            elif msg_type == "run_native_steps":
                steps = msg.get("steps",[])
                if steps and sess.udid: asyncio.create_task(run_native_steps(session_id, steps))
            elif msg_type == "logcat_start":
                if sess.logcat_task and not sess.logcat_task.done(): sess.logcat_task.cancel()
                pkg = msg.get("package", sess.current_package or "")
                sess.logcat_task = asyncio.create_task(stream_logcat(session_id, pkg))
            elif msg_type == "logcat_stop":
                if sess.logcat_task and not sess.logcat_task.done(): sess.logcat_task.cancel()
                if sess.logcat_proc:
                    try: sess.logcat_proc.kill()
                    except Exception: pass
                    sess.logcat_proc = None
                await websocket.send_json({"type": "logcat_status", "running": False})
            elif msg_type == "wifi_get_ip":
                udid = sess.udid
                if not udid:
                    devs = await get_devices()
                    if devs: udid = devs[0]["id"]
                if udid:
                    ip = await _get_device_ip(udid)
                    await websocket.send_json({"type": "wifi_ip", "ip": ip})
                else:
                    await websocket.send_json({"type": "wifi_ip", "ip": ""})
            elif msg_type == "wifi_enable_tcpip":
                port = msg.get("port", 5555)
                await websocket.send_json({"type": "wifi_status", "status": "enabling", "message": f"Enabling TCP/IP on port {port}…"})
                udid = sess.udid
                if not udid:
                    devs = await get_devices()
                    if devs: udid = devs[0]["id"]; sess.udid = udid; sess.model = devs[0]["model"]
                if not udid:
                    await websocket.send_json({"type": "wifi_status", "status": "error", "message": "No USB device found. Connect via USB first."})
                else:
                    detected_ip = await _get_device_ip(udid)
                    rc, out, err = await adb_s("tcpip", str(port), udid=udid, timeout=10)
                    out_str = out.decode(errors="replace").lower() if out else ""
                    if rc == 0 or "restarting" in out_str:
                        msg_text = f"TCP/IP enabled :{port}."
                        if detected_ip: msg_text += f" IP: {detected_ip} — disconnect USB now."
                        else: msg_text += " IP not detected — check Settings → About → Status."
                        await websocket.send_json({"type": "wifi_status", "status": "idle", "message": msg_text, "ip": detected_ip})
                    else:
                        raw = (err or out or b"").decode(errors="replace").strip()
                        await websocket.send_json({"type": "wifi_status", "status": "error", "message": f"Failed: {raw or 'Unknown error'}"})
            elif msg_type == "wifi_connect":
                ip = msg.get("ip","").strip(); port = msg.get("port", 5555)
                if not ip:
                    await websocket.send_json({"type": "wifi_status", "status": "error", "message": "No IP provided"})
                else:
                    await websocket.send_json({"type": "wifi_status", "status": "connecting", "message": f"Connecting to {ip}:{port}…"})
                    rc, out, err = await adb("connect", f"{ip}:{port}", timeout=12)
                    output = out.decode(errors="replace").strip()
                    if rc == 0 and ("connected" in output.lower() or "already" in output.lower()):
                        new_udid = f"{ip}:{port}"
                        sess.udid = new_udid; sess.model = sess.model or new_udid
                        sess.screen_w, sess.screen_h = await get_screen_size(new_udid)
                        sess.current_package = await get_foreground_package(new_udid)
                        await websocket.send_json({"type": "wifi_status", "status": "connected", "message": f"Connected to {ip}:{port} via WiFi"})
                        await websocket.send_json({"type": "device_status", "connected": True, "id": new_udid, "model": sess.model})
                        if sess.streamer_task: sess.streamer_task.cancel()
                        await asyncio.sleep(0.5)
                        sess.streamer_task = asyncio.create_task(stream_screen(session_id))
                    else:
                        await websocket.send_json({"type": "wifi_status", "status": "error", "message": output or f"Could not connect to {ip}:{port}"})
            elif msg_type == "wifi_disconnect":
                ip = msg.get("ip","").strip(); port = msg.get("port", 5555)
                await adb("disconnect", f"{ip}:{port}", timeout=8)
                await websocket.send_json({"type": "wifi_status", "status": "idle", "message": f"Disconnected from {ip}:{port}"})
            elif msg_type == "save_local_recording":
                name = payload.get("name", f"recording_{int(time.time())}"); actions = payload.get("actions",[])
                os.makedirs("recordings", exist_ok=True)
                safe_name = re.sub(r"[^\w\-]", "_", name)
                path = f"recordings/{safe_name}.json"
                with open(path, "w", encoding="utf-8") as f:
                    json.dump({"name": name, "device": sess.model, "udid": sess.udid, "package": sess.current_package, "platform": "ANDROID", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "actions": actions}, f, indent=2)
                await websocket.send_json({"type": "recording_saved", "path": path})

    except WebSocketDisconnect:
        log.info(f"[{session_id}] Client disconnected")
    except Exception as e:
        log.error(f"[{session_id}] WS error: {e}")
    finally:
        if sess.streamer_task: sess.streamer_task.cancel()
        if sess.logcat_task: sess.logcat_task.cancel()
        if sess.logcat_proc:
            try: sess.logcat_proc.kill()
            except Exception: pass
        if sess.runner_proc:
            try: sess.runner_proc.kill()
            except Exception: pass
        sessions.pop(session_id, None)

# ── REST ENDPOINTS ───────────────────────────────────────────

@app.get("/health")
async def health():
    devices = await get_devices()
    return {"status": "ok", "devices": devices, "sessions": len(sessions)}

@app.get("/wifi/ip")
async def wifi_get_ip_endpoint():
    devices = await get_devices()
    if not devices: return {"ok": False, "ip": "", "error": "No device"}
    ip = await _get_device_ip(devices[0]["id"])
    return {"ok": True, "ip": ip, "udid": devices[0]["id"]}

@app.post("/wifi/enable")
async def wifi_enable_endpoint(port: int = 5555):
    devices = await get_devices()
    if not devices: return {"ok": False, "error": "No USB device connected"}
    udid = devices[0]["id"]
    ip = await _get_device_ip(udid)
    rc, out, err = await adb_s("tcpip", str(port), udid=udid, timeout=10)
    out_str = out.decode(errors="replace").lower() if out else ""
    if rc == 0 or "restarting" in out_str: return {"ok": True, "ip": ip, "port": port}
    return {"ok": False, "error": (err or out or b"").decode(errors="replace").strip()}

@app.post("/wifi/connect")
async def wifi_connect_endpoint(ip: str, port: int = 5555):
    rc, out, err = await adb("connect", f"{ip}:{port}", timeout=12)
    output = out.decode(errors="replace").strip()
    if rc == 0 and ("connected" in output.lower() or "already" in output.lower()): return {"ok": True, "message": output}
    return {"ok": False, "error": output or err.decode(errors="replace").strip()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8767, log_level="info")
