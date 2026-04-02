#!/usr/bin/env python3
"""
CLIP-based image search engine.
Reads a JSON command from stdin, executes, outputs JSON result to stdout.

Commands:
  {"cmd": "index", "paths": ["/path/to/img1.jpg", ...], "db_file": "/path/db.index", "paths_file": "/path/db_paths.json"}
  {"cmd": "search", "query_path": "/path/query.jpg", "db_file": "/path/db.index", "paths_file": "/path/db_paths.json", "threshold": 50, "top_k": 20}
  {"cmd": "add", "paths": [...], "db_file": "...", "paths_file": "..."}
  {"cmd": "clear", "db_file": "...", "paths_file": "..."}
  {"cmd": "list", "db_file": "...", "paths_file": "..."}
  {"cmd": "stats", "db_file": "...", "paths_file": "..."}
"""

import sys
import json
import os
import traceback

def load_model():
    import torch
    from transformers import CLIPProcessor, CLIPModel
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    model.eval()
    return model, processor

def image_to_vector(path, model, processor):
    import torch
    from PIL import Image
    img = Image.open(path).convert("RGB")
    inputs = processor(images=img, return_tensors="pt")
    with torch.no_grad():
        features = model.get_image_features(**inputs)
    # transformers 5.x may return a ModelOutput object instead of a raw tensor
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
    import faiss
    import numpy as np
    if os.path.exists(db_file) and os.path.exists(paths_file):
        index = faiss.read_index(db_file)
        with open(paths_file, "r") as f:
            paths = json.load(f)
        return index, paths
    else:
        index = faiss.IndexFlatIP(512)
        return index, []

def save_db(index, paths, db_file, paths_file):
    import faiss
    faiss.write_index(index, db_file)
    with open(paths_file, "w") as f:
        json.dump(paths, f)

def main():
    cmd_data = json.loads(sys.stdin.read())
    cmd = cmd_data["cmd"]
    db_file = cmd_data["db_file"]
    paths_file = cmd_data["paths_file"]

    if cmd == "stats":
        import faiss
        if os.path.exists(db_file) and os.path.exists(paths_file):
            index = faiss.read_index(db_file)
            with open(paths_file, "r") as f:
                paths = json.load(f)
            print(json.dumps({
                "success": True,
                "totalImages": len(paths),
                "indexLoaded": True,
                "modelLoaded": True
            }))
        else:
            print(json.dumps({
                "success": True,
                "totalImages": 0,
                "indexLoaded": False,
                "modelLoaded": True
            }))
        return

    if cmd == "list":
        import faiss
        if os.path.exists(paths_file):
            with open(paths_file, "r") as f:
                paths = json.load(f)
            images = [{"id": i, "path": p, "filename": os.path.basename(p)} for i, p in enumerate(paths)]
            print(json.dumps({"success": True, "images": images}))
        else:
            print(json.dumps({"success": True, "images": []}))
        return

    if cmd == "clear":
        import faiss
        index = faiss.IndexFlatIP(512)
        save_db(index, [], db_file, paths_file)
        print(json.dumps({"success": True, "message": "Database cleared"}))
        return

    if cmd == "index":
        model, processor = load_model()
        import faiss
        import numpy as np
        index, paths = load_db(db_file, paths_file)
        new_paths = cmd_data["paths"]
        count = 0
        errors = []
        for p in new_paths:
            try:
                vec = image_to_vector(p, model, processor)
                index.add(vec)
                paths.append(p)
                count += 1
            except Exception as e:
                errors.append({"path": p, "error": str(e)})
        save_db(index, paths, db_file, paths_file)
        print(json.dumps({
            "success": True,
            "count": count,
            "message": f"Indexed {count} images",
            "errors": errors
        }))
        return

    if cmd == "add":
        model, processor = load_model()
        import faiss
        index, paths = load_db(db_file, paths_file)
        new_paths = cmd_data["paths"]
        count = 0
        errors = []
        for p in new_paths:
            if p in paths:
                continue
            try:
                vec = image_to_vector(p, model, processor)
                index.add(vec)
                paths.append(p)
                count += 1
            except Exception as e:
                errors.append({"path": p, "error": str(e)})
        save_db(index, paths, db_file, paths_file)
        print(json.dumps({
            "success": True,
            "count": count,
            "message": f"Added {count} new images",
            "errors": errors
        }))
        return

    if cmd == "search":
        model, processor = load_model()
        import faiss
        import numpy as np
        query_path = cmd_data["query_path"]
        threshold = float(cmd_data.get("threshold", 50))
        top_k = int(cmd_data.get("top_k", 20))

        index, paths = load_db(db_file, paths_file)

        if index.ntotal == 0:
            print(json.dumps({
                "success": True,
                "results": [],
                "message": "Database is empty"
            }))
            return

        vec = image_to_vector(query_path, model, processor)
        k = min(top_k, index.ntotal)
        scores, ids = index.search(vec, k)

        results = []
        for score, idx in zip(scores[0], ids[0]):
            pct = round(float(score) * 100, 2)
            if pct >= threshold and idx >= 0 and idx < len(paths):
                results.append({
                    "id": int(idx),
                    "path": paths[idx],
                    "filename": os.path.basename(paths[idx]),
                    "score": pct,
                    "imageUrl": f"/api/images/{int(idx)}"
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        print(json.dumps({
            "success": True,
            "results": results
        }))
        return

    print(json.dumps({"success": False, "error": f"Unknown command: {cmd}"}))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)
