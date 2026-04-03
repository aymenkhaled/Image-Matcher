#!/usr/bin/env python3
"""
Persistent CLIP + FAISS HTTP server.
Loads the model ONCE at startup, then handles all requests via HTTP.
This avoids the 10s model reload on every request.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys
import os
import threading
import traceback

print("Loading CLIP model (may download ~600MB on first run)...", file=sys.stderr, flush=True)

import torch
from transformers import CLIPProcessor, CLIPModel
import faiss
import numpy as np
from PIL import Image

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
model.eval()

print("CLIP model ready!", file=sys.stderr, flush=True)

lock = threading.Lock()


def image_to_vector(path):
    img = Image.open(path).convert("RGB")
    inputs = processor(images=img, return_tensors="pt")
    with torch.no_grad():
        features = model.get_image_features(**inputs)
    if isinstance(features, torch.Tensor):
        vec = features
    elif hasattr(features, "pooler_output") and features.pooler_output is not None:
        vec = features.pooler_output
    elif hasattr(features, "last_hidden_state"):
        vec = features.last_hidden_state[:, 0]
    else:
        vec = features[0]
    vec = vec / vec.norm(p=2, dim=-1, keepdim=True)
    return vec.numpy().astype("float32")


def load_db(db_file, paths_file):
    if os.path.exists(db_file) and os.path.exists(paths_file):
        index = faiss.read_index(db_file)
        with open(paths_file) as f:
            paths = json.load(f)
        return index, paths
    return faiss.IndexFlatIP(512), []


def save_db(index, paths, db_file, paths_file):
    os.makedirs(os.path.dirname(db_file), exist_ok=True)
    faiss.write_index(index, db_file)
    with open(paths_file, "w") as f:
        json.dump(paths, f)


def handle_cmd(data):
    cmd = data["cmd"]
    db_file = data["db_file"]
    paths_file = data["paths_file"]

    with lock:
        if cmd == "stats":
            if os.path.exists(db_file) and os.path.exists(paths_file):
                index = faiss.read_index(db_file)
                with open(paths_file) as f:
                    paths = json.load(f)
                return {"success": True, "totalImages": len(paths), "indexLoaded": True, "modelLoaded": True}
            return {"success": True, "totalImages": 0, "indexLoaded": False, "modelLoaded": True}

        if cmd == "list":
            if os.path.exists(paths_file):
                with open(paths_file) as f:
                    paths = json.load(f)
                images = [{"id": i, "path": p, "filename": os.path.basename(p)} for i, p in enumerate(paths)]
                return {"success": True, "images": images}
            return {"success": True, "images": []}

        if cmd == "clear":
            index = faiss.IndexFlatIP(512)
            save_db(index, [], db_file, paths_file)
            return {"success": True, "message": "Database cleared"}

        if cmd in ("index", "add"):
            index, paths = load_db(db_file, paths_file)
            new_paths = data["paths"]
            count, errors = 0, []
            for p in new_paths:
                if cmd == "add" and p in paths:
                    continue
                try:
                    vec = image_to_vector(p)
                    index.add(vec)
                    paths.append(p)
                    count += 1
                except Exception as e:
                    errors.append({"path": p, "error": str(e)})
            save_db(index, paths, db_file, paths_file)
            return {"success": True, "count": count, "message": f"Added {count} images", "errors": errors}

        if cmd == "search":
            query_path = data["query_path"]
            threshold = float(data.get("threshold", 50))
            top_k = int(data.get("top_k", 20))
            index, paths = load_db(db_file, paths_file)
            if index.ntotal == 0:
                return {"success": True, "results": [], "message": "Database is empty"}
            vec = image_to_vector(query_path)
            k = min(top_k, index.ntotal)
            scores, ids = index.search(vec, k)
            results = []
            for score, idx in zip(scores[0], ids[0]):
                pct = round(float(score) * 100, 2)
                if pct >= threshold and 0 <= int(idx) < len(paths):
                    results.append({
                        "id": int(idx),
                        "path": paths[int(idx)],
                        "filename": os.path.basename(paths[int(idx)]),
                        "score": pct,
                        "imageUrl": f"/api/images/{int(idx)}"
                    })
            results.sort(key=lambda x: x["score"], reverse=True)
            return {"success": True, "results": results}

        return {"success": False, "error": f"Unknown command: {cmd}"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            result = handle_cmd(data)
        except Exception as e:
            result = {"success": False, "error": str(e), "traceback": traceback.format_exc()}

        response = json.dumps(result).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5050
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Image server ready on port {port}", file=sys.stderr, flush=True)
    server.serve_forever()
