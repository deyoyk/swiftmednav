"""Evaluate the trained RF model: checks determinism + metric sanity. Run: python evaluate.py"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def main():
    r1 = subprocess.run([sys.executable, "train.py"], cwd=HERE, capture_output=True, text=True)
    if r1.returncode != 0:
        print("train.py failed:\n" + r1.stderr[-2000:]);
        sys.exit(1)
    with open(os.path.join(HERE, "models", "model.json")) as fh:
        m1 = json.load(fh)
    r2 = subprocess.run([sys.executable, "train.py"], cwd=HERE, capture_output=True, text=True)
    with open(os.path.join(HERE, "models", "model.json")) as fh:
        m2 = json.load(fh)
    assert m1["datasetHash"] == m2["datasetHash"], "non-deterministic dataset"
    assert abs(m1["accuracy"] - m2["accuracy"]) < 1e-9, "non-deterministic training"
    assert m1["synthetic"] is True
    for c, p in m1["perClass"].items():
        assert 0 <= p["precision"] <= 1 and 0 <= p["recall"] <= 1 and 0 <= p["f1"] <= 1, c
    assert abs(sum(m1["featureImportance"].values()) - 1.0) < 1e-6
    cm = m1["confusionMatrix"]["matrix"]
    assert len(cm) == 3 and all(len(r) == 3 for r in cm)
    print("OK deterministic. accuracy=%.3f (SYNTHETIC - not real-world). hash=%s" % (m1["accuracy"], m1["datasetHash"]))

if __name__ == "__main__":
    main()
