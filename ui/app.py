import os
from flask import Flask, render_template, jsonify, request
import yaml
import subprocess

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

INVENTORY_FILE = os.path.join(BASE_DIR, "inventory.yml")
PLAYBOOK_FILE = os.path.join(BASE_DIR, "playbook.yml")

app = Flask(__name__)


def load_inventory():
    with open(INVENTORY_FILE, "r") as f:
        return yaml.safe_load(f)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/inventory")
def api_inventory():
    return jsonify(load_inventory())


@app.route("/api/run", methods=["POST"])
def api_run():
    data = request.json
    customer = data["customer"]
    extra_vars = data.get("extra_vars", {})
    tags = data.get("tags")  # ← تگ‌های اختیاری

    cmd = [
        "ansible-playbook",
        "-i", INVENTORY_FILE,
        PLAYBOOK_FILE,
        "--limit", customer
    ]

    if extra_vars:
        extra_vars_str = " ".join(f"{k}='{v}'" for k, v in extra_vars.items())
        cmd += ["--extra-vars", extra_vars_str]

    if tags:
        cmd += ["--tags", tags]

    subprocess.Popen(cmd, cwd=BASE_DIR)

    return jsonify({
        "status": "started",
        "customer": customer,
        "extra_vars": extra_vars,
        "tags": tags
    })


@app.route("/api/save", methods=["POST"])
def save():
    data = request.json
    customer = data["customer"]
    new_vars = data["vars"]

    inventory = load_inventory()
    inventory["all"]["hosts"][customer]["vars"].update(new_vars)

    with open(INVENTORY_FILE, "w") as f:
        yaml.dump(inventory, f, allow_unicode=True)

    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
