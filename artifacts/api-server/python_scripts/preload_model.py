#!/usr/bin/env python3
"""
Pre-download the CLIP model during the build step so it is cached in the
deployment image. At runtime the Python server will find it in HF_HOME
and skip the download entirely, making cold starts near-instant.
"""
import os
import sys

hf_home = os.environ.get("HF_HOME", "~/.cache/huggingface")
print(f"Pre-downloading openai/clip-vit-base-patch32 to {hf_home} ...", flush=True)

from transformers import CLIPModel, CLIPProcessor

CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

print("CLIP model pre-downloaded and cached successfully.", flush=True)
