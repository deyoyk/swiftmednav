"""SwiftMedNav ML service: RandomForest congestion classifier (synthetic demo data).
Provenance: NO verified real traffic dataset — training data is synthetic, seed 42,
for demonstration only. Never present accuracy as real-world performance."""
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json, os

MODEL_VERSION = "rf-v1-seed42"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "model.json")
PICKLE_PATH = os.path.join(os.path.dirname(__file__), "models", "rf_model.pkl")
FEATURES = ["vehicle_count", "avg_speed", "hour"]


class Features(BaseModel):
    vehicle_count: int = Field(ge=0, le=500)
    avg_speed: float = Field(ge=0, le=120)
    hour: int = Field(ge=0, le=23)


def _frame(x: list):
    import pandas as _pd
    return _pd.DataFrame([x], columns=FEATURES)


def _load_bundle():
    import joblib as _joblib
    if not os.path.exists(PICKLE_PATH):
        return None
    bundle = _joblib.load(PICKLE_PATH)
    if bundle.get("version") != MODEL_VERSION:
        return None
    return bundle


def rf_predict(f: Features):
    """Real RandomForest inference when sklearn + trained pickle are available, else None."""
    try:
        bundle = _load_bundle()
        if bundle is None:
            return None
        proba = bundle["model"].predict_proba(_frame([f.vehicle_count, f.avg_speed, f.hour]))[0]
        labels = list(bundle["model"].classes_)
        order = ["low", "medium", "high"]
        pmap = {lab: float(proba[labels.index(lab)]) for lab in order if lab in labels}
        cls = max(pmap, key=lambda k: pmap[k])
        return cls, pmap, "randomforest"
    except Exception:
        return None


app = FastAPI(title="SwiftMedNav ML (demo)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def heuristic_predict(f: Features):
    # fallback if model file missing: transparent rule, labeled as such
    if f.avg_speed < 15 or f.vehicle_count > 120:
        return "high", {"low": 0.05, "medium": 0.15, "high": 0.8}
    if f.avg_speed < 28 or f.vehicle_count > 60:
        return "medium", {"low": 0.15, "medium": 0.7, "high": 0.05}
    return "low", {"low": 0.8, "medium": 0.15, "high": 0.05}


@app.get("/model/info")
def info():
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH) as fh:
            return json.load(fh)
    return {"modelVersion": MODEL_VERSION, "note": "model.json not trained yet — heuristic fallback", "synthetic": True}


@app.post("/predict")
def predict(f: Features):
    try:
        rf = rf_predict(f)
        if rf is not None:
            cls, proba, engine = rf
            return {"class": cls, "probabilities": proba, "modelVersion": MODEL_VERSION, "engine": engine, "source": "predicted", "synthetic": True}
        cls, proba = heuristic_predict(f)
        return {"class": cls, "probabilities": proba, "modelVersion": MODEL_VERSION, "engine": "heuristic-fallback", "source": "predicted", "synthetic": True,
                "note": "trained rf_model.pkl unavailable — transparent rule fallback"}
    except Exception as e:
        raise HTTPException(422, str(e))


@app.post("/tree-path")
def tree_path(f: Features, n_trees: int = 3):
    """Trace a live prediction through real trees: feature, threshold, branch per node.
    Returns the first n_trees decision paths plus the forest vote. 503 when unavailable."""
    try:
        bundle = _load_bundle()
        if bundle is None:
            raise HTTPException(503, "trained rf_model.pkl unavailable — train via train.py first")
        import numpy as _np
        from sklearn.tree import _tree as _tree_mod
        x = [f.vehicle_count, f.avg_speed, f.hour]
        clf = bundle["model"]
        proba = clf.predict_proba(_frame(x))[0]
        labels = list(clf.classes_)
        order = ["low", "medium", "high"]
        pmap = {lab: float(proba[labels.index(lab)]) for lab in order if lab in labels}
        paths = []
        for ti in range(min(max(1, n_trees), len(clf.estimators_))):
            est = clf.estimators_[ti]
            t = est.tree_
            node, depth, nodes = 0, 0, []
            while t.feature[node] != _tree_mod.TREE_UNDEFINED and depth < 25:
                fi = int(t.feature[node])
                thr = float(t.threshold[node])
                go_left = x[fi] <= thr
                nodes.append({
                    "node": int(node),
                    "depth": depth,
                    "feature": FEATURES[fi] if fi < len(FEATURES) else f"f{fi}",
                    "threshold": round(thr, 3),
                    "value": round(float(x[fi]), 3),
                    "op": "<=" if go_left else ">",
                    "branch": "left" if go_left else "right",
                })
                node = int(t.children_left[node] if go_left else t.children_right[node])
                depth += 1
            leaf = [float(v) for v in t.value[node][0]]
            paths.append({
                "tree": ti,
                "nodes": nodes,
                "truncated": depth >= 25,
                "leafVotes": leaf,
                "leafClass": labels[int(_np.argmax(leaf))],
            })
        cls = max(pmap, key=lambda k: pmap[k])
        return {"class": cls, "probabilities": pmap, "modelVersion": MODEL_VERSION,
                "engine": "randomforest", "source": "predicted", "synthetic": True,
                "nTreesTotal": len(clf.estimators_), "paths": paths}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"tree-path failed: {e}")
