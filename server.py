"""
TORQUEGUARD 3D - Local Simulation Server Launcher
Starts a local HTTP server and automatically opens TORQUEGUARD 3D in the default browser.
"""

import http.server
import socketserver
import webbrowser
import socket
import os
import sys

def find_available_port(start_port=8000, max_attempts=20):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    return start_port

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = find_available_port(8000)
    
    Handler = http.server.SimpleHTTPRequestHandler
    Handler.extensions_map.update({
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
    })

    url = f"http://localhost:{port}/index.html"
    print("=" * 72)
    print("  TORQUEGUARD 3D - Intelligent Motor Stall Detection & Safe Recovery")
    print("  3D Digital Twin Simulation Server Running")
    print(f"  Access URL: {url}")
    print("=" * 72)
    print("  Press CTRL+C in this console to stop the server.")

    # Automatically open browser
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"  Could not launch browser automatically: {e}")

    try:
        with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Simulation server stopped cleanly.")
        sys.exit(0)

if __name__ == '__main__':
    run_server()
