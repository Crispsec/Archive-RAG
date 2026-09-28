from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams
from openai import OpenAI
import json
import os

# --- Environment Variables ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://willma.surf.nl/api/v0")
LLM_API_KEY = os.getenv("LLM_API_KEY")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-8B")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))

# Initialize clients
client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
qdrant = QdrantClient(QDRANT_HOST, port=QDRANT_PORT)

# Determine embedding size dynamically
test_emb = client.embeddings.create(
    model=EMBEDDING_MODEL,
    input="test"
).data[0].embedding
embedding_size = len(test_emb)
print(f"Detected embedding size: {embedding_size}")

# Recreate collection
# WARNING: This will delete all existing data in the collection!
qdrant.recreate_collection(
    collection_name="archive_docs",
    vectors_config=VectorParams(size=embedding_size, distance="Cosine")
)


# --- Load documents from the data directory ---
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
documents = []

def process_file(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Use excerpt for embedding (it's a good summary)
    text_to_embed = data.get("excerpt", "")
    
    # Create embedding
    embedding = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text_to_embed
    ).data[0].embedding

    # Construct iiif_id (extracting from the manifest URL if needed, 
    # but the app.py expects a partial ID like 'N10656132')
    # Example manifest: https://access.iisg.amsterdam/iiif/presentation/N10656132/manifest
    iiif_url = data.get("iiif_manifest", "")
    iiif_id = "N10656132" # Default fallback
    if "/presentation/" in iiif_url:
        iiif_id = iiif_url.split("/presentation/")[1].split("/")[0]

    return PointStruct(
        id=data.get("id"),
        vector=embedding,
        payload={
            "title": data.get("title"),
            "excerpt": data.get("excerpt"),
            "full_text": data.get("full_text"),
            "iiif_id": iiif_id,
            "institute_code": "10622", # Hardcoded for this PoC
            "handle": data.get("handle"),
            "date_created": data.get("date_created"),
            "collection": data.get("collection"),
            "creator": data.get("creator"),
        }
    )

for filename in os.listdir(DATA_DIR):
    if filename.endswith(".json"):
        file_path = os.path.join(DATA_DIR, filename)
        print(f"Processing {filename}...")
        try:
            doc = process_file(file_path)
            documents.append(doc)
        except Exception as e:
            print(f"Error processing {filename}: {e}")

# Insert all records
if documents:
    qdrant.upsert(
        collection_name="archive_docs",
        points=documents,
        wait=True
    )
    print(f"Qdrant collection 'archive_docs' recreated and {len(documents)} points inserted from data directory.")
else:
    print("No documents found to ingest.")
