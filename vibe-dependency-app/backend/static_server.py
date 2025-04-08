import os
from flask import Flask, send_from_directory

def setup_static_serving(app):
    # Path to the static files (frontend build)
    static_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend/build'))
    print(f"Setting up static file serving from: {static_folder}")
    
    # Add a specific route for static files
    @app.route('/static/<path:filename>')
    def serve_static_files(filename):
        static_directory = os.path.join(static_folder, 'static')
        print(f"Serving static file from /static/ directory: {filename}")
        return send_from_directory(static_directory, filename)
    
    # Configure static file serving for other paths
    def serve_index(path=''):
        print(f"Serving index.html for path: '{path}'")
        return send_from_directory(static_folder, 'index.html')
    
    def serve_static(path):
        print(f"Checking path: '{path}'")
        full_path = os.path.join(static_folder, path)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            print(f"Serving file: {full_path}")
            return send_from_directory(static_folder, path)
        else:
            print(f"File not found, serving index.html instead: {full_path}")
            return serve_index()
    
    # Add URL rules directly instead of using decorators
    # This ensures the rules are added when the function is called, not when the module is imported
    app.add_url_rule('/', 'serve_index', serve_index)
    app.add_url_rule('/<path:path>', 'serve_static', serve_static)
    
    return app 