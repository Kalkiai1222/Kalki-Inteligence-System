import sys
import json
import os
import sqlite3
import logging
import sqlite3

# Try FAISS, fallback if anything goes wrong
try:
    import faiss
    import numpy as np
except ImportError:
    faiss = None

# Try loading sentence-transformers. Fallback to basic sklearn TFIDF
encoder = None
try:
    from sentence_transformers import SentenceTransformer
    encoder = SentenceTransformer('all-MiniLM-L6-v2')
    is_tfidf = False
except ImportError:
    try:
         from sklearn.feature_extraction.text import TfidfVectorizer
         encoder = TfidfVectorizer()
         is_tfidf = True
    except:
         encoder = None

def get_db_path():
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dev.db')

def get_faiss_path(company_id):
    mem_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    os.makedirs(mem_dir, exist_ok=True)
    return os.path.join(mem_dir, f'faiss_{company_id}.index')

def text_to_vector(text, company_id):
    if is_tfidf:
        # Load all texts from SQLite for this company to fit TFIDF
        conn = sqlite3.connect(get_db_path())
        c = conn.cursor()
        c.execute('SELECT featureText FROM ElasticMemory WHERE companyId = ?', (company_id,))
        rows = c.fetchall()
        corpus = [r[0] for r in rows] + [text]
        enc = encoder.fit(corpus)
        vec = enc.transform([text]).toarray()[0].astype(np.float32)
        # Pad to 384 arbitrarily if TFIDF is small
        if vec.shape[0] < 384:
             vec = np.pad(vec, (0, 384 - vec.shape[0]))
        else:
             vec = vec[:384]
        return vec
    else:
        return encoder.encode(text).astype(np.float32)

def add_memory(company_id, text, memory_id):
    if not faiss or not encoder:
        return {"error": "Missing ML dependencies"}
        
    vec = text_to_vector(text, company_id)
    vec = vec.reshape(1, -1)
    
    idx_path = get_faiss_path(company_id)
    dim = vec.shape[1]
    
    if os.path.exists(idx_path):
        index = faiss.read_index(idx_path)
    else:
        # IndexIDMap allows passing custom IDs (like our int memory_id)
        index = faiss.IndexIDMap(faiss.IndexFlatIP(dim))
        
    # Faiss requires ids to be int64
    _id = np.array([int(memory_id)], dtype=np.int64)
    
    # Normalize for inner product (cosine similarity)
    faiss.normalize_L2(vec)
    index.add_with_ids(vec, _id)
    faiss.write_index(index, idx_path)
    return {"status": "success", "indexed": True}

def search_memory(company_id, text, top_k=3):
    if not faiss or not encoder:
        return {"error": "Missing ML dependencies", "matches": []}
        
    idx_path = get_faiss_path(company_id)
    if not os.path.exists(idx_path):
        return {"matches": []}
        
    index = faiss.read_index(idx_path)
    vec = text_to_vector(text, company_id)
    vec = vec.reshape(1, -1)
    faiss.normalize_L2(vec)
    
    # K cannot be larger than the total number of items in the index
    k = min(top_k, index.ntotal)
    if k == 0:
        return {"matches": []}
        
    D, I = index.search(vec, k)
    
    matches = []
    conn = sqlite3.connect(get_db_path())
    c = conn.cursor()
    
    for score, idx in zip(D[0], I[0]):
        if idx == -1: continue
        # Fetch original payload from DB
        c.execute('SELECT featureText, correctionData FROM ElasticMemory WHERE embeddingId = ? AND companyId = ?', (int(idx), company_id))
        row = c.fetchone()
        if row:
            matches.append({
               "score": float(score),
               "text": row[0],
               "correctionData": json.loads(row[1]) if row[1] else None
            })
            
    return {"matches": matches}

def batch_classify(company_id, room_features):
    results = []
    for room in room_features:
        # Search FAISS index for the closest geometric room signature
        res = search_memory(company_id, room, top_k=1)
        best_match = res.get("matches", [])
        if best_match and best_match[0]["score"] > 0.85: # High confidence similarity
             classification = best_match[0].get("correctionData", {}).get("classification", "Unknown Zone")
             results.append({"feature": room, "predicted": classification, "confidence": best_match[0]["score"]})
        else:
             results.append({"feature": room, "predicted": "Unclassified Room", "confidence": 0.0})
    return {"classifications": results}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command"}))
        sys.exit(1)
        
    cmd = sys.argv[1]
    
    try:
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        if cmd == "add":
            res = add_memory(data["companyId"], data["text"], data["embeddingId"])
            print(json.dumps(res))
            
        elif cmd == "search":
            res = search_memory(data["companyId"], data["text"], data.get("topK", 3))
            print(json.dumps(res))

        elif cmd == "classify":
            res = batch_classify(data["companyId"], data["rooms"])
            print(json.dumps(res))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
