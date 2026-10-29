"""Train RandomForest on synthetic traffic data (seed 42). Reproducible 80/20 split."""
import numpy as np, pandas as pd, json, os, hashlib
try:
    import joblib
except ImportError:
    joblib = None  # type: ignore
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support, accuracy_score

SEED = 42
HERE = os.path.dirname(__file__)

def make_synthetic(n=3000, seed=SEED):
    rng = np.random.default_rng(seed)
    hours = rng.integers(0, 24, n)
    rush = ((hours >= 8) & (hours <= 10)) | ((hours >= 17) & (hours <= 20))
    vehicle_count = (rng.poisson(40, n) + rush * rng.poisson(90, n)).astype(int)
    avg_speed = np.clip(55 - vehicle_count * 0.28 + rng.normal(0, 4, n) - rush * 6, 3, 80)
    y = np.where((vehicle_count > 110) | (avg_speed < 15), "high",
        np.where((vehicle_count > 55) | (avg_speed < 28), "medium", "low"))
    return pd.DataFrame({"vehicle_count": vehicle_count, "avg_speed": avg_speed, "hour": hours, "congestion": y})

def main():
    df = make_synthetic()
    os.makedirs(f"{HERE}/data", exist_ok=True)
    df.to_csv(f"{HERE}/data/synthetic_traffic.csv", index=False)
    X = df[["vehicle_count", "avg_speed", "hour"]]
    y = df["congestion"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)
    clf = RandomForestClassifier(n_estimators=200, random_state=SEED, n_jobs=-1)
    clf.fit(Xtr, ytr)
    pred = clf.predict(Xte)
    prec, rec, f1, _ = precision_recall_fscore_support(yte, pred, labels=["low", "medium", "high"], zero_division=0)
    cm = confusion_matrix(yte, pred, labels=["low", "medium", "high"]).tolist()
    report = {
        "modelVersion": "rf-v1-seed42", "synthetic": True,
        "provenance": "synthetic generator (seed 42), NOT real traffic. Demo only.",
        "splitSeed": SEED, "accuracy": accuracy_score(yte, pred),
        "classDist": y.value_counts().to_dict(),
        "perClass": {c: {"precision": float(prec[i]), "recall": float(rec[i]), "f1": float(f1[i])} for i, c in enumerate(["low", "medium", "high"])},
        "confusionMatrix": {"labels": ["low", "medium", "high"], "matrix": cm},
        "featureImportance": dict(zip(["vehicle_count", "avg_speed", "hour"], [float(x) for x in clf.feature_importances_])),
        "datasetHash": hashlib.sha256(pd.util.hash_pandas_object(df).values.tobytes()).hexdigest()[:16],
    }
    os.makedirs(f"{HERE}/models", exist_ok=True)
    with open(f"{HERE}/models/model.json", "w") as fh:
        json.dump(report, fh, indent=2)
    if joblib is not None:
        joblib.dump({"model": clf, "features": ["vehicle_count", "avg_speed", "hour"], "version": report["modelVersion"]}, f"{HERE}/models/rf_model.pkl")
    else:
        print("joblib missing — skipping rf_model.pkl")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
