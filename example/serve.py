#!/usr/bin/env python3
"""
Simple HTTP server for the ASI183MM Spectrometer example interface
"""
import os
import sys
import argparse
import http.server
import socketserver
import webbrowser
from pathlib import Path

def start_server(port=8080, open_browser=True):
    """Start a simple HTTP server to serve the example files"""
    
    # Ensure we're in the correct directory
    example_dir = Path(__file__).parent.absolute()
    os.chdir(example_dir)
    
    # Set up the server
    handler = http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            server_url = f"http://localhost:{port}"
            print(f"Starting server at {server_url}")
            print("Press Ctrl+C to stop the server")
            
            # Open browser if requested
            if open_browser:
                webbrowser.open(server_url)
            
            # Start the server
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Error: Port {port} is already in use. Try a different port.")
            return 1
        else:
            print(f"Error starting server: {e}")
            return 1
            
    return 0

def main():
    """Parse command line arguments and start the server"""
    
    parser = argparse.ArgumentParser(
        description="Serve ASI183MM Spectrometer example interface"
    )
    parser.add_argument(
        "--port", type=int, default=8080,
        help="Port to run the server on (default: 8080)"
    )
    parser.add_argument(
        "--no-browser", action="store_true",
        help="Don't automatically open a browser window"
    )
    
    args = parser.parse_args()
    
    return start_server(port=args.port, open_browser=not args.no_browser)

if __name__ == "__main__":
    sys.exit(main()) 