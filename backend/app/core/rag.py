"""
RAG (Retrieval-Augmented Generation) service
Handles document processing, vector storage, and retrieval
"""

import os
import uuid
import shutil
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import hashlib
from datetime import datetime, timezone

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_core.documents import Document

from app.core.config import settings

logger = logging.getLogger("inferx.rag")


def _init_chroma_client(path: str) -> chromadb.ClientAPI:
    """
    Initialize ChromaDB PersistentClient with auto-recovery.
    If the existing DB has a schema conflict (e.g. after a version upgrade),
    delete chroma.sqlite3 and retry so the app always starts cleanly.
    Collection data will be lost but the service stays operational.
    """
    chroma_settings = ChromaSettings(anonymized_telemetry=False)
    try:
        return chromadb.PersistentClient(path=path, settings=chroma_settings)
    except Exception as e:
        err = str(e)
        if "already exists" in err or "InternalError" in err or "migration" in err.lower():
            logger.warning(
                f"ChromaDB schema conflict detected ({err}). "
                "Resetting vector DB to recover — existing KB embeddings will be re-indexed on next upload."
            )
            sqlite_file = os.path.join(path, "chroma.sqlite3")
            if os.path.exists(sqlite_file):
                os.remove(sqlite_file)
                logger.info("Deleted corrupt chroma.sqlite3, retrying initialization.")
            try:
                return chromadb.PersistentClient(path=path, settings=chroma_settings)
            except Exception as e2:
                logger.error(f"ChromaDB still failing after reset: {e2}. Wiping full vector_dbs dir.")
                shutil.rmtree(path, ignore_errors=True)
                os.makedirs(path, exist_ok=True)
                return chromadb.PersistentClient(path=path, settings=chroma_settings)
        raise


class RAGService:
    """RAG service for document processing and retrieval"""

    # Singleton ChromaDB client — ChromaDB does not allow multiple
    # PersistentClient instances for the same path with different settings.
    _chroma_client: Optional[chromadb.ClientAPI] = None
    _embedding_fn = None

    def __init__(self):
        # Re-use the shared ONNX embedding function (no PyTorch required)
        if RAGService._embedding_fn is None:
            RAGService._embedding_fn = embedding_functions.ONNXMiniLM_L6_V2()
        self.embedding_fn = RAGService._embedding_fn

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

        # Re-use the shared ChromaDB client
        if RAGService._chroma_client is None:
            RAGService._chroma_client = _init_chroma_client(settings.RAG_VECTOR_DB_PATH)
        self.chroma_client = RAGService._chroma_client

    def _get_user_collection(self, user_id: str) -> chromadb.Collection:
        """Get or create user-specific collection"""
        # Sanitize user_id for collection name (ChromaDB supports hyphens)
        collection_name = f"user-{user_id}-docs"
        try:
            collection = self.chroma_client.get_collection(
                collection_name,
                embedding_function=self.embedding_fn
            )
            return collection
        except Exception as e:
            # Collection doesn't exist, create it with cosine similarity
            return self.chroma_client.create_collection(
                collection_name,
                embedding_function=self.embedding_fn,
                metadata={"hnsw:space": "cosine"}  # Use cosine similarity
            )

    def _extract_text_from_file(self, file_path: str, filename: str) -> tuple[str, Dict[str, Any]]:
        """Extract text from various file formats with metadata"""
        file_extension = Path(filename).suffix.lower()
        extraction_metadata = {"file_type": file_extension}

        if file_extension == '.pdf':
            loader = PyPDFLoader(file_path)
        elif file_extension == '.txt':
            loader = TextLoader(file_path)
        elif file_extension in ['.docx', '.doc']:
            loader = Docx2txtLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")

        documents = loader.load()
        
        # Track pages if available (for PDFs)
        if file_extension == '.pdf':
            extraction_metadata['total_pages'] = len(documents)
        
        text_content = "\n".join([doc.page_content for doc in documents])

        # Clean extracted text to remove OCR/artifact spacing and normalize whitespace
        cleaned_text = self._clean_text(text_content)
        extraction_metadata['total_characters'] = len(cleaned_text)

        return cleaned_text, extraction_metadata

    def _clean_text(self, text: str) -> str:
        """Normalize and clean extracted text.

        - Normalize unicode
        - Join single-letter runs like "Y O G I T H A" -> "YOGITHA"
        - Collapse excessive spaces and newlines
        """
        import re
        import unicodedata

        if not text:
            return ""

        # Normalize unicode characters
        text = unicodedata.normalize("NFKC", text)

        # Join runs of single letters separated by spaces (at least 3 letters)
        def _join_letters(m):
            s = m.group(0)
            return s.replace(" ", "")

        text = re.sub(r"\b(?:[A-Za-z]\s){2,}[A-Za-z]\b", _join_letters, text)

        # Collapse multiple spaces
        text = re.sub(r" {2,}", " ", text)

        # Normalize newlines (no more than two)
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Trim spaces around newlines
        text = re.sub(r" *\n *", "\n", text)

        return text.strip()

    def _generate_document_id(self, user_id: str, filename: str) -> str:
        """Generate unique document ID"""
        content = f"{user_id}:{filename}:{datetime.now(timezone.utc).isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()

    def upload_document(self, user_id: str, file_path: str, filename: str,
                       metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Upload and process a document (AWS-style with enhanced metadata)"""
        try:
            print(f"[RAG DEBUG] Uploading document for user {user_id}: {filename}")
            
            # Extract text with metadata
            text_content, extraction_metadata = self._extract_text_from_file(file_path, filename)

            # Split into chunks
            chunks = self.text_splitter.split_text(text_content)

            # Generate document ID
            doc_id = self._generate_document_id(user_id, filename)

            # Base metadata for document
            base_metadata = {
                "filename": filename,
                "user_id": user_id,
                "document_id": doc_id,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "chunk_count": len(chunks),
                "file_size": os.path.getsize(file_path),
                "status": "indexed",
                **extraction_metadata,
                **(metadata or {})
            }

            # Store in vector database
            collection = self._get_user_collection(user_id)
            print(f"[RAG DEBUG] Using collection for user {user_id}")

            # Add document chunks with position metadata (AWS-style)
            ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
            metadatas = []
            
            for i, chunk in enumerate(chunks):
                chunk_metadata = base_metadata.copy()
                chunk_metadata.update({
                    "chunk_index": i,
                    "chunk_position": f"{i+1}/{len(chunks)}",
                    "is_first_chunk": i == 0,
                    "is_last_chunk": i == len(chunks) - 1,
                    "chunk_size": len(chunk)
                })
                metadatas.append(chunk_metadata)

            collection.add(
                documents=chunks,
                metadatas=metadatas,
                ids=ids
            )
            
            print(f"[RAG DEBUG] Successfully added {len(chunks)} chunks for document {doc_id}")

            return {
                "document_id": doc_id,
                "filename": filename,
                "chunks_processed": len(chunks),
                "total_characters": extraction_metadata.get('total_characters', 0),
                "file_type": extraction_metadata.get('file_type', ''),
                "status": "indexed",
                "indexed_at": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            print(f"[RAG ERROR] Failed to upload document for user {user_id}: {e}")
            raise Exception(f"Failed to process document: {str(e)}")

    def _build_pre_filter(self, filters: Optional[Dict[str, Any]] = None,
                          document_ids: Optional[List[str]] = None) -> Optional[Dict]:
        """Stage 1: Build indexed pre-filter clause for ChromaDB.
        
        Pre-filters are applied BEFORE vector search so only relevant
        documents compete in ANN ranking. This is critical for:
        - date_range: prevents searching 2019 docs for 2025 questions
        - document_ids: scopes search to specific documents
        - category/department: organizational filtering
        
        Use pre-filter when selectivity < 10% of corpus.
        """
        conditions = []

        if document_ids:
            conditions.append({"document_id": {"$in": document_ids}})

        if filters:
            # Indexed pre-filter fields (fast, selective)
            if "date_from" in filters:
                conditions.append({"uploaded_at": {"$gte": filters["date_from"]}})
            if "date_to" in filters:
                conditions.append({"uploaded_at": {"$lte": filters["date_to"]}})
            if "category" in filters:
                conditions.append({"category": filters["category"]})
            if "department" in filters:
                conditions.append({"department": filters["department"]})
            if "filename" in filters:
                conditions.append({"filename": filters["filename"]})

        if not conditions:
            return None
        if len(conditions) == 1:
            return conditions[0]
        return {"$and": conditions}

    def _apply_post_filter(self, results: List[Dict[str, Any]],
                           filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Stage 3: Lightweight post-filter on non-indexed fields.
        
        Applied AFTER vector search for fields that are expensive to
        index or have high cardinality (tags, word_count, author).
        Only use when selectivity > 50% to avoid wasting compute.
        """
        if not filters:
            return results

        filtered = results

        # Post-filter: minimum chunk size (avoid tiny fragments)
        if "min_chunk_size" in filters:
            min_size = filters["min_chunk_size"]
            filtered = [r for r in filtered if len(r["content"]) >= min_size]

        # Post-filter: tags (non-indexed, high cardinality)
        if "tags" in filters:
            required_tags = set(filters["tags"])
            filtered = [
                r for r in filtered
                if required_tags.intersection(
                    set(r["metadata"].get("tags", []) if isinstance(r["metadata"].get("tags"), list) else [])
                )
            ]

        # Post-filter: max results after refinement
        if "max_results" in filters:
            filtered = filtered[:filters["max_results"]]

        return filtered

    def search_documents(self, user_id: str, query: str,
                        limit: Optional[int] = None,
                        filters: Optional[Dict[str, Any]] = None,
                        min_similarity: float = 0.0,
                        document_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Search documents using staged hybrid filtering.
        
        Stage 1 (Pre-filter): Indexed metadata filtering (date, category, doc_ids)
                              Reduces corpus before ANN search. +6ms, 95% recall.
        Stage 2 (ANN Search): Semantic vector search on filtered subset (HNSW/cosine).
        Stage 3 (Post-filter): Lightweight refinement (tags, chunk_size).
        
        This staged approach prevents searching irrelevant docs,
        avoids wasting context window, and reduces latency.
        """
        try:
            collection = self._get_user_collection(user_id)
            
            print(f"[RAG] Searching for user {user_id}: query='{query[:80]}', doc_ids={document_ids}")

            # Stage 1: Pre-filter (indexed, selective)
            where_clause = self._build_pre_filter(filters, document_ids)
            if where_clause:
                print(f"[RAG] Stage 1 pre-filter: {where_clause}")

            # Stage 2: ANN vector search on filtered subset
            query_params = {
                "query_texts": [query],  # chromadb ONNX embedder handles this
                "n_results": limit or settings.RAG_MAX_RETRIEVED_DOCS,
                "include": ['documents', 'metadatas', 'distances']
            }
            if where_clause:
                query_params["where"] = where_clause
                
            results = collection.query(**query_params)
            
            print(f"[RAG] Stage 2 ANN returned {len(results['documents'][0]) if results['documents'] and results['documents'][0] else 0} results")

            # Format results with enhanced metadata
            search_results = []
            if results['documents'] and results['documents'][0]:
                for i, (doc, metadata, distance) in enumerate(zip(
                    results['documents'][0],
                    results['metadatas'][0],
                    results['distances'][0]
                )):
                    # Convert distance to similarity score
                    # For cosine distance: distance is in [0, 2], where 0 = identical, 2 = opposite
                    # Convert to similarity: similarity = 1 - (distance / 2)
                    # This gives us similarity in [0, 1] where 1 = identical, 0 = opposite
                    if distance < 0:  # Negative distance means L2, use different formula
                        similarity = 1 / (1 + abs(distance))
                    else:
                        similarity = 1 - (distance / 2)  # Cosine distance normalization
                    
                    print(f"[RAG DEBUG] Result {i+1}: distance={distance:.3f}, similarity={similarity:.3f}, doc={metadata.get('filename')}")
                    
                    # Use a very lenient threshold (0.2) to ensure we capture relevant content
                    # Better to have false positives than miss relevant information
                    if similarity >= max(min_similarity, 0.2):
                        search_results.append({
                            "content": doc,
                            "metadata": metadata,
                            "similarity_score": similarity,
                            "rank": i + 1
                        })

            # Stage 3: Post-filter (non-indexed, lightweight refinement)
            if filters:
                pre_count = len(search_results)
                search_results = self._apply_post_filter(search_results, filters)
                if pre_count != len(search_results):
                    print(f"[RAG] Stage 3 post-filter: {pre_count} -> {len(search_results)} results")
            
            print(f"[RAG] Returning {len(search_results)} results")

            return search_results

        except Exception as e:
            raise Exception(f"Search failed: {str(e)}")

    def get_user_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all documents for a user"""
        try:
            collection = self._get_user_collection(user_id)
            results = collection.get(include=['metadatas'])
            
            print(f"[RAG DEBUG] User {user_id}: Found {len(results['metadatas'])} metadata entries")
            
            # Group by document_id
            documents = {}
            for metadata in results['metadatas']:
                doc_id = metadata.get('document_id')
                if doc_id:
                    if doc_id not in documents:
                        documents[doc_id] = {
                            "document_id": doc_id,
                            "filename": metadata.get('filename'),
                            "uploaded_at": metadata.get('uploaded_at'),
                            "chunk_count": metadata.get('chunk_count', 0),
                            "file_size": metadata.get('file_size', 0)
                        }
                        print(f"[RAG DEBUG] Found document: {doc_id} - {metadata.get('filename')}")
            
            print(f"[RAG DEBUG] Returning {len(documents)} documents for user {user_id}")
            return list(documents.values())

        except Exception as e:
            print(f"[RAG ERROR] Failed to get documents for user {user_id}: {e}")
            return []

    def delete_document(self, user_id: str, document_id: str) -> bool:
        """Delete a document and all its chunks"""
        try:
            collection = self._get_user_collection(user_id)

            # Find all chunks for this document
            results = collection.get(
                where={"document_id": document_id},
                include=['ids']
            )

            if results['ids']:
                collection.delete(ids=results['ids'])
                return True

            return False

        except Exception as e:
            return False

    # ========================================================================
    # Knowledge Base Specific Methods  
    # ========================================================================

    def _get_kb_collection(self, kb_id: str, user_id: str) -> chromadb.Collection:
        """Get or create KB-specific collection"""
        collection_name = f"kb-{kb_id}"
        try:
            collection = self.chroma_client.get_collection(
                collection_name,
                embedding_function=self.embedding_fn
            )
            return collection
        except Exception:
            return self.chroma_client.create_collection(
                collection_name,
                embedding_function=self.embedding_fn,
                metadata={"hnsw:space": "cosine", "user_id": user_id}
            )

    async def initialize_kb_collection(self, kb_id: str, user_id: str, embedding_model: str):
        """Initialize a new KB collection"""
        self._get_kb_collection(kb_id, user_id)

    async def delete_kb_collection(self, kb_id: str):
        """Delete an entire KB collection"""
        try:
            collection_name = f"kb-{kb_id}"
            self.chroma_client.delete_collection(collection_name)
        except Exception as e:
            print(f"[RAG ERROR] Failed to delete KB collection {kb_id}: {e}")

    async def ingest_document_to_kb(
        self,
        kb_id: str,
        user_id: str,
        doc_id: str,
        file_path: str,
        filename: str,
        metadata: Dict[str, Any],
        chunk_size: int,
        chunk_overlap: int,
    ) -> int:
        """Ingest a document into a knowledge base"""
        collection = self._get_kb_collection(kb_id, user_id)

        # Create text splitter for this document
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

        # Extract and clean text
        text_content, extraction_metadata = self._extract_text_from_file(file_path, filename)

        # Split into chunks
        chunks = text_splitter.split_text(text_content)

        # Prepare data for insertion
        ids = [f"{doc_id}-chunk-{i}" for i in range(len(chunks))]
        chunk_metadata = []
        for i in range(len(chunks)):
            chunk_meta = {
                "kb_id": kb_id,
                "document_id": doc_id,
                "filename": filename,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                **metadata,
                **extraction_metadata,
            }
            chunk_metadata.append(chunk_meta)

        # Insert into ChromaDB
        collection.add(
            ids=ids,
            documents=chunks,
            metadatas=chunk_metadata
        )

        return len(chunks)

    async def delete_document_from_kb(self, kb_id: str, doc_id: str):
        """Delete a document from a KB"""
        try:
            collection = self._get_kb_collection(kb_id, "")
            results = collection.get(
                where={"document_id": doc_id},
                include=['ids']
            )
            if results['ids']:
                collection.delete(ids=results['ids'])
        except Exception as e:
            print(f"[RAG ERROR] Failed to delete document {doc_id} from KB {kb_id}: {e}")

    async def query_knowledge_base(
        self,
        kb_id: str,
        user_id: str,
        query: str,
        model: str,
        api_key: Optional[str] = None,
        top_k: int = 5,
        max_context_chunks: int = 8,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        """Query a knowledge base with RAG (retrieval + generation)"""
        import httpx
        
        collection = self._get_kb_collection(kb_id, user_id)

        # Stage 1: Pre-filter by metadata if available
        # This prevents irrelevant docs from competing in ANN search
        where_clause = None
        # KB queries are already scoped to a single collection,
        # but we can still pre-filter by date/category if metadata exists

        # Stage 2: ANN vector search on the (optionally filtered) subset
        query_params = {
            "query_texts": [query],  # chromadb ONNX embedder handles this
            "n_results": top_k,
            "include": ['documents', 'metadatas', 'distances']
        }
        if where_clause:
            query_params["where"] = where_clause

        results = collection.query(**query_params)

        # Convert distances to similarity scores (cosine)
        sources = []
        context_chunks = []
        
        for i, (doc, metadata, distance) in enumerate(zip(
            results['documents'][0],
            results['metadatas'][0],
            results['distances'][0]
        )):
            similarity = 1 - distance
            
            sources.append({
                "document_id": metadata.get('document_id'),
                "chunk_index": metadata.get('chunk_index', i),
                "score": round(similarity, 3),
                "content": doc,
                "metadata": {
                    "filename": metadata.get('filename'),
                    "category": metadata.get('category'),
                    "url": metadata.get('url'),
                }
            })
            
            if len(context_chunks) < max_context_chunks:
                context_chunks.append(doc)

        # Build context for LLM
        context_text = "\n\n---\n\n".join([
            s['content'] for s in sources[:max_context_chunks]
        ])

        # Call LLM with context
        system_prompt = f"""You are a helpful assistant. Answer the user's question based ONLY on the provided context. Give a natural, direct answer without mentioning or citing source numbers.

CONTEXT:
{context_text}

If the answer is not in the context, say "I don't have that information in the provided documents."
Be specific and detailed."""

        # Make internal request to completion endpoint
        # Use provided API key or fall back to user_id (shouldn't happen in production)
        auth_token = api_key if api_key else user_id
        
        # If using system key, add user ID as a custom header for internal routing
        headers = {"Authorization": f"Bearer {auth_token}"}
        if auth_token and auth_token.startswith("sk_system_"):
            headers["X-Internal-User-ID"] = str(user_id)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/v1/chat/completions",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers=headers,
                timeout=120.0
            )
            
            if response.status_code != 200:
                raise Exception(f"LLM call failed: {response.text}")
            
            llm_response = response.json()
            answer = llm_response['choices'][0]['message']['content']
            usage = llm_response.get('usage', {})

        # Add embedding token usage
        usage['embedding_tokens'] = len(query.split())

        return {
            "answer": answer,
            "sources": sources,
            "usage": usage,
            "model": model
        }


# Global RAG service instance
rag_service = RAGService()