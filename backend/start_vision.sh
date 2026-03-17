#!/bin/bash
# Start Zenit Vision Server
cd "$(dirname "$0")"
pip install -r requirements.txt -q
echo "Starting Zenit Vision Server on ws://localhost:8767"
echo "Make sure your Android device is connected via USB and authorized (adb devices)"
python vision_server.py
