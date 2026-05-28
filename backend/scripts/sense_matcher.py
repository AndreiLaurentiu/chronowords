import sys
import json
from sentence_transformers import SentenceTransformer, util


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def main():
    raw = sys.stdin.read()

    if not raw.strip():
        print(json.dumps({"error": "No input received"}))
        return

    payload = json.loads(raw)

    sense = payload.get("sense", "")
    examples = payload.get("examples", [])
    top_k = int(payload.get("topK", 5))

    if not sense or not examples:
        print(json.dumps({
            "matches": {
                "t1": [],
                "t2": [],
                "unknown": []
            }
        }))
        return

    sentences = [ex["sentence"] for ex in examples]

    model = SentenceTransformer(MODEL_NAME)

    sense_embedding = model.encode(sense, convert_to_tensor=True, normalize_embeddings=True)
    sentence_embeddings = model.encode(sentences, convert_to_tensor=True, normalize_embeddings=True)

    similarities = util.cos_sim(sense_embedding, sentence_embeddings)[0].cpu().tolist()

    enriched = []

    for ex, score in zip(examples, similarities):
        enriched.append({
            **ex,
            "similarity": round(float(score), 4)
        })

    grouped = {
        "t1": [],
        "t2": [],
        "unknown": []
    }

    for ex in enriched:
        period = ex.get("period", "unknown")
        if period not in grouped:
            period = "unknown"
        grouped[period].append(ex)

    for period in grouped:
        grouped[period] = sorted(
            grouped[period],
            key=lambda item: item["similarity"],
            reverse=True
        )[:top_k]

    print(json.dumps({"matches": grouped}, ensure_ascii=False))


if __name__ == "__main__":
    main()