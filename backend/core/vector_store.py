"""ChromaDB vector store wrapper for incident postmortem RAG."""

import logging
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_CHROMA_PATH = str(Path(__file__).resolve().parent.parent / "chroma_db")
_COLLECTION_NAME = "incident_postmortems"
_COLLECTION_METADATA = {
    "hnsw:space": "cosine",
    "hnsw:construction_ef": 100,
    "hnsw:M": 16,
}
_SIMILARITY_THRESHOLD = 0.30
_BATCH_SIZE = 50

client = chromadb.PersistentClient(path=_CHROMA_PATH)
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


def get_collection() -> chromadb.Collection:
    """Return or create the incident postmortems ChromaDB collection."""
    return client.get_or_create_collection(
        name=_COLLECTION_NAME,
        metadata=_COLLECTION_METADATA,
    )


def index_chunks(chunks: list[dict]) -> int:
    """Embed and upsert postmortem chunks into ChromaDB, returning total indexed."""
    if not chunks:
        return 0

    try:
        collection = get_collection()
        global_start = collection.count()
        total_indexed = 0

        for batch_start in range(0, len(chunks), _BATCH_SIZE):
            batch = chunks[batch_start : batch_start + _BATCH_SIZE]
            texts = [c["text"] for c in batch]
            embeddings = embedding_model.encode(texts).tolist()

            batch_offset = global_start + batch_start
            ids = [f"incident_{batch_offset + i}" for i in range(len(batch))]
            metadatas = [
                {"url": c["url"], "chunk_index": c["chunk_index"]} for c in batch
            ]

            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
            )

            total_indexed += len(batch)
            if total_indexed % 100 == 0 or total_indexed == len(chunks):
                print(f"Indexed {total_indexed} chunks...")

        return total_indexed
    except Exception as exc:
        logger.warning("Chunk indexing failed error=%s", exc)
        return 0


def search_incidents(query: str, n_results: int = 3) -> list[dict]:
    """Search the corpus for incidents semantically similar to the query."""
    try:
        collection = get_collection()
        if collection.count() == 0:
            return []

        query_embedding = embedding_model.encode(query).tolist()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        incidents: list[dict] = []
        for doc, metadata, distance in zip(documents, metadatas, distances):
            similarity = 1 - distance
            if similarity <= _SIMILARITY_THRESHOLD:
                continue
            excerpt = doc[:400] + "..." if len(doc) > 400 else doc
            incidents.append(
                {
                    "excerpt": excerpt,
                    "source_url": metadata.get("url", ""),
                    "similarity": round(similarity, 3),
                }
            )

        return incidents
    except Exception as exc:
        logger.warning("Incident search failed error=%s", exc)
        return []


def corpus_size() -> int:
    """Return the number of documents in the incident postmortem collection."""
    try:
        return get_collection().count()
    except Exception as exc:
        logger.warning("Corpus size check failed error=%s", exc)
        return 0
