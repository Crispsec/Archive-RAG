from fastapi import FastAPI, Query, Body, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient
from openai import OpenAI
import json, os
from pydantic import BaseModel
import requests
from typing import List, Dict, Any, Generator
import ollama 

# --- Pydantic Models ---
class SearchRequest(BaseModel):
    query: str

class AskRequest(BaseModel):
    query: str

class DocumentPayload(BaseModel):
    id: str
    title: str
    excerpt: str
    iiif_id: str 
    institute_code: str 
    handle: str
    date_created: str
    collection: str
    creator: str
    viewer_url: str # ADDED: The complete URL to the IIIF viewer
    full_text: str # ADDED: The complete transcription/text

class AskResponse(BaseModel):
    answer: str
    documents: List[DocumentPayload]

# --- FastAPI Setup ---
app = FastAPI(title="Historical Archives MCP Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Environment Variables ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://willma.surf.nl/api/v0")
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-8B")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
INTERNAL_API_BASE = os.getenv("INTERNAL_API_BASE", "http://localhost:8000")

# --- Clients ---
llm = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY) 
qdrant = QdrantClient(QDRANT_HOST, port=QDRANT_PORT)


@app.get("/mcp/manifest")
def manifest():
    return FileResponse("mcp_manifest.yaml")


@app.post("/mcp/search")
def mcp_search(body: SearchRequest):
    """Searches Qdrant for relevant documents based on the query."""
    
    # Base URL components (Using the IISG Universal Viewer Host as requested)
    UNIVERSAL_VIEWER_BASE = "https://access.iisg.amsterdam/uv.html"
    IIIF_MANIFEST_BASE_URL = "https://access.iisg.amsterdam/iiif/presentation"
    
    # Safe default parameters requested by user (c=0, m=0, cv=0 are indices for collection/manifest/canvas)
    # Note: Using the hash fragment (#?) as requested by your example URL
    DEFAULT_UV_PARAMS = "&c=0&m=0&cv=0" 

    try:
        # Create embedding for the query
        emb = llm.embeddings.create(
            model=EMBEDDING_MODEL, 
            input=body.query
        ).data[0].embedding
    except Exception as e:
        # IMPORTANT: If this fails, Ollama is likely down or the model isn't loaded.
        raise HTTPException(
            status_code=503,
            detail=f"Embedding creation failed. Ensure Ollama/LLM server is running and model 'mxbai-embed-large' is loaded. Error: {e}"
        )
    
    # Search Qdrant using the modern query_points API
    try:
        search_result = qdrant.query_points(
            collection_name="archive_docs", 
            query=emb, 
            limit=3
        )
        hits = search_result.points
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Qdrant search failed: {e}"
        )
    
    # Map hits to the required DocumentPayload structure, extracting new fields
    results = []
    for hit in hits:
        # Construct the IIIF manifest URL from payload fields
        iiif_manifest_url = f"{IIIF_MANIFEST_BASE_URL}/{hit.payload['iiif_id']}"
        
        # Construct the final viewer URL for the iframe using the hash fragment
        viewer_url = f"{UNIVERSAL_VIEWER_BASE}#?manifest={iiif_manifest_url}{DEFAULT_UV_PARAMS}"
        
        results.append({
            "id": str(hit.id),
            "title": hit.payload["title"],
            "excerpt": hit.payload["excerpt"],
            "iiif_id": hit.payload["iiif_id"], 
            "institute_code": hit.payload["institute_code"], 
            "handle": hit.payload["handle"],
            "date_created": hit.payload.get("date_created", "N/A"),
            "collection": hit.payload.get("collection", "N/A"),
            "creator": hit.payload.get("creator", "N/A"),
            "viewer_url": viewer_url,
            "full_text": hit.payload.get("full_text", hit.payload.get("excerpt", "Text not available.")), 
        })

    return {"results": results}


# --- Streaming RAG Endpoint ---

def llm_stream_generator(context: str, user_query: str, documents_json: str) -> Generator[str, None, None]:
    """Generator to stream the LLM response chunk by chunk."""
    
    system_prompt = (
        "You are an expert Historical Archives Assistant. Your task is to answer the user's query "
        "concisely and accurately, strictly based on the provided context from the historical documents. "
        "Do not use external knowledge. If the context does not contain the answer, state that fact."
    )
    
    full_prompt = (
        f"CONTEXT (Retrieved Historical Documents):\n---\n{context}\n---\n"
        f"USER QUERY:\n{user_query}"
    )

    try:
        # Use the streaming API call
        stream = llm.chat.completions.create(
            model=LLM_MODEL, 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_prompt}
            ],
            stream=True,
            temperature=0.0
        )
        
        # Stream the LLM text chunks
        for chunk in stream:
            if not chunk.choices:
                continue
            content = chunk.choices[0].delta.content
            if content:
                # Yield the raw text chunk
                yield content

        # documents_json is already a JSON string, no second encoding needed.
        yield f"\n\n$$DOCS_METADATA$${documents_json}"

    except Exception as e:
        # If the LLM call fails, yield an error message to the client
        print(f"LLM Streaming Error: {e}")
        yield f"\n\n[STREAMING ERROR: LLM failed to respond. Check your Ollama/LLM server and ensure 'llama3' model is running: {e}]"


@app.post("/mcp/ask")
def ask(body: AskRequest):
    """Performs RAG and streams the LLM answer, followed by document metadata."""
    
    user_query = body.query

    # 1. Search Qdrant for relevant documents
    try:
        # Execute the search request
        response = requests.post(
            f"{INTERNAL_API_BASE}/mcp/search",
            json={"query": user_query}
        )
        
        # Crucial step: Check for 4xx/5xx status codes.
        response.raise_for_status() 
        
        # Now safely parse the JSON
        search_response = response.json()
        
    except requests.exceptions.ConnectionError:
        # Connection failed (e.g., the Uvicorn server is not running)
        raise HTTPException(
            status_code=503,
            detail="Could not connect to the internal /mcp/search endpoint. Ensure the server is running."
        )
    except requests.exceptions.RequestException as e:
        # Catch errors from raise_for_status (non-200) or other request issues.
        error_detail = response.text if 'response' in locals() and response.text else str(e)
        status_code = response.status_code if 'response' in locals() else 500
        
        raise HTTPException(
            status_code=status_code,
            detail=f"Failed to retrieve search results from /mcp/search. Check server logs for /mcp/search errors. Original error: {error_detail}"
        )


    documents = search_response.get("results", [])

    # 2. Prepare context for the LLM
    context = "\n\n".join([doc["excerpt"] for doc in documents])
    
    # 3. Serialize document metadata for the footer
    documents_json = json.dumps(documents)

    # 4. Return the StreamingResponse
    return StreamingResponse(
        llm_stream_generator(context, user_query, documents_json),
        media_type="text/plain" 
    )
