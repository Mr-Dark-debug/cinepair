import urllib.request
import json
import time
import sys
from datetime import datetime

BACKEND_URL = "https://cinepair-signaling.onrender.com/"
INTERVAL_SECONDS = 30

def ping_server():
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        req = urllib.request.Request(
            BACKEND_URL, 
            headers={'User-Agent': 'CinePair Keep-Alive Ping Agent'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                print(f"[{timestamp}] 💚 Ping Successful! Backend status: {data.get('status')}. Active Rooms: {data.get('active_rooms')}")
                sys.stdout.flush()
            else:
                print(f"[{timestamp}] ⚠️ Ping returned status code: {response.status}")
                sys.stdout.flush()
    except Exception as e:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] 🛑 Ping Failed: {str(e)}")
        sys.stdout.flush()

if __name__ == "__main__":
    print("==========================================================")
    print("      CinePair Signaling Backend Keep-Alive Agent")
    print("==========================================================")
    print(f"Target URL: {BACKEND_URL}")
    print(f"Interval:   {INTERVAL_SECONDS} seconds")
    print("Running... (Press Ctrl+C to stop)")
    print("----------------------------------------------------------")
    sys.stdout.flush()
    
    while True:
        ping_server()
        time.sleep(INTERVAL_SECONDS)
