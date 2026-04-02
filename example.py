import os

import requests


def list_ollama_models():
    base = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    url = f"{base}/api/tags"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    data = r.json()
    models = data.get("models") or []
    return sorted(m.get("name", "") for m in models if m.get("name"))


def main():
    try:
        names = list_ollama_models()
        print("--------\n" + ("\n".join(names) if names else "(no models)"))
    except Exception as err:
        print("An error occurred:", err)


if __name__ == "__main__":
    main()
