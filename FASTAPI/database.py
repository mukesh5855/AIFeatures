import os
import chromadb
import ollama
from langchain_chroma import Chroma
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.prompts import ChatPromptTemplate

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
MAX_FILE_SIZE = 10 * 1024 * 1024

OLLAMA_HOST = os.getenv(
    "OLLAMA_HOST", "http://localhost:11434"
)
EMBED_MODEL = os.getenv(
    "EMBED_MODEL", "nomic-embed-text"
)
LLM_MODEL = os.getenv(
    "LLM_MODEL", "tinyllama:latest"
)
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")

ollama_client = ollama.Client(host=OLLAMA_HOST)

chroma_client = chromadb.PersistentClient(
    path=CHROMA_PATH
)

collection = chroma_client.get_or_create_collection(
    name="pdf_rag",
    metadata={"hnsw:space": "cosine"},
)

langChainembeddings = OllamaEmbeddings(
    model=EMBED_MODEL
)

langChainllm = ChatOllama(
    model=LLM_MODEL,
    temperature=0,
)

# Persistent vector database directory.
VECTOR_DB_DIR = "./chroma_db"

vector_store = Chroma(
    collection_name="rag_documents",
    persist_directory=VECTOR_DB_DIR,
    embedding_function=langChainembeddings,
)

UPLOAD_DIR = "./TempStore"