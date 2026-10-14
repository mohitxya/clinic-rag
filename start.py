#!/usr/bin/env python3
"""
Clinic RAG Platform Launcher
Launches FastAPI backend, Next.js frontend, and opens your default browser cleanly (supporting WSL, Linux, Mac, Windows).
"""

import os
import sys
import time
import subprocess
import webbrowser
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
VENV_UVICORN = os.path.join(PROJECT_ROOT, ".venv", "bin", "uvicorn")
UVICORN_CMD = [VENV_UVICORN] if os.path.exists(VENV_UVICORN) else [sys.executable, "-m", "uvicorn"]

def is_port_open(url):
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=1) as resp:
            return resp.status in (200, 304, 404)
    except Exception:
        return False

def open_browser_cleanly(url):
    """Opens browser cleanly in WSL, Linux, macOS, and Windows without xdg-open errors."""
    # WSL strategy 1: wslview
    try:
        if subprocess.call(["wslview", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
            return True
    except Exception:
        pass

    # WSL strategy 2: Windows cmd.exe /c start
    try:
        if subprocess.call(["cmd.exe", "/c", "start", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
            return True
    except Exception:
        pass

    # WSL strategy 3: Windows PowerShell Start-Process
    try:
        if subprocess.call(["powershell.exe", "-c", f"Start-Process '{url}'"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
            return True
    except Exception:
        pass

    # Standard python webbrowser fallback
    try:
        return webbrowser.open(url)
    except Exception:
        return False

def main():
    print("=" * 70)
    print("  🩺 NEUROTOLOGY RAG CLINIC PLATFORM (Dr. Amol Acharya ENT Clinic)")
    print("=" * 70)

    # 1. Start FastAPI Backend if not running
    backend_proc = None
    if not is_port_open("http://127.0.0.1:8000/api/stats"):
        print("⚡ Starting FastAPI Backend on http://127.0.0.1:8000 ...")
        backend_proc = subprocess.Popen(
            [*UVICORN_CMD, "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=PROJECT_ROOT
        )
    else:
        print("✓ FastAPI Backend is active on http://127.0.0.1:8000")

    # 2. Start Next.js Frontend if not running
    frontend_proc = None
    frontend_dir = os.path.join(PROJECT_ROOT, "frontend")
    if not is_port_open("http://127.0.0.1:3000"):
        print("🎨 Starting Next.js React Frontend on http://127.0.0.1:3000 ...")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev", "--", "-H", "127.0.0.1", "-p", "3000"],
            cwd=frontend_dir
        )
    else:
        print("✓ Next.js Frontend is active on http://127.0.0.1:3000")

    # Wait for servers
    print("⏳ Initializing services...")
    for _ in range(30):
        if is_port_open("http://127.0.0.1:3000") and is_port_open("http://127.0.0.1:8000/api/stats"):
            break
        time.sleep(0.5)

    app_url = "http://127.0.0.1:3000"
    print("\n" + "=" * 70)
    print(f"🚀 Application Ready! Opening Browser at: {app_url}")
    print("   Press Ctrl+C to stop services.")
    print("=" * 70 + "\n")

    # Open default browser cleanly
    open_browser_cleanly(app_url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping Clinic RAG services...")
        if backend_proc:
            backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
        print("Done!")

if __name__ == "__main__":
    main()
