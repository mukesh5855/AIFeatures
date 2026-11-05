
import { useState } from "react";
import "./Rag.css";
import RagQuery from "./RagQuery";
import RagLangChainUpload from "./RagLangChainUpload";
import RagLangChainQuery from "./RagLangChainQuery";
import RagLangGraphUpload from "./RagLangGraphUpload";
import RagLangGraphQuery from "./RagLangGraphQuery";
import "./RagLangChain.css";

export default function Rag() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);

  const [isQueryOpen, setIsQueryOpen] = useState(false);

  const [isLangChainUploadOpen, setIsLangChainUploadOpen] = useState(false);

  const [isLangChainQueryOpen, setIsLangChainQueryOpen] = useState(false);

  const [isLangGraphUploadOpen, setIsLangGraphUploadOpen] = useState(false);

  const [isLangGraphQueryOpen, setIsLangGraphQueryOpen] = useState(false);

  const openPopup = () => {
    setFile(null);
    setError("");
    setResponse(null);
    setIsPopupOpen(true);
  };

  const closePopup = () => {
    if (loading) return;

    setIsPopupOpen(false);
    setFile(null);
    setError("");
    setResponse(null);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    setError("");
    setResponse(null);
    setFile(null);

    if (!selectedFile) return;

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!file) {
      setError("Please select a PDF file before uploading.");
      return;
    }

    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const apiResponse = await fetch(
        "http://127.0.0.1:8000/documents/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const contentType = apiResponse.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        data = await apiResponse.json();
      } else {
        data = await apiResponse.text();
      }

      if (!apiResponse.ok) {
        const detail =
          typeof data === "object" && data !== null
            ? data.detail || data.message
            : data;

        throw new Error(
          typeof detail === "string"
            ? detail
            : `Upload failed with status ${apiResponse.status}.`
        );
      }

      setResponse({
        ...(
          typeof data === "object" && data !== null && !Array.isArray(data)
            ? data
            : { result: data }
        ),
        uploadedFileName: file.name,
        uploadedFileSize: file.size,
        uploadedFileType: file.type || "application/pdf",
      });
    } catch (err) {
      console.error("PDF upload error:", err);

      setError(
        err instanceof TypeError
          ? "Unable to connect to the API. Check that FastAPI is running and CORS is configured."
          : err.message || "An unexpected error occurred while uploading."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(2)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <section className="rag-page">
      <h1>Upload PDF</h1>
      <p>Select and upload a PDF to index it for RAG search.</p>

      <div className="rag-button-container">
      <div className="rag-button-row">
        <button
          type="button"
          className="open-upload-btn"
          onClick={openPopup}
        >
          Upload
        </button>

        <button
          type="button"
          className="ask-questions-btn"
          onClick={() => setIsQueryOpen(true)}
        >
          Ask
        </button>
      </div>

      <div className="rag-button-row">
        <button
          type="button"
          className="open-upload-btn"
          onClick={() => setIsLangChainUploadOpen(true)}
        >
         Upload LangChain
        </button>

        <button
          type="button"
          className="ask-questions-btn"
          onClick={() => setIsLangChainQueryOpen(true)}
        >
         Question LangChain
        </button>
      </div>

      <div className="rag-button-row">
        <button
          type="button"
          className="open-upload-btn"
          onClick={() => setIsLangGraphUploadOpen(true)}
        >
         Upload LangGraph
        </button>

        <button
          type="button"
          className="ask-questions-btn"
          onClick={() => setIsLangGraphQueryOpen(true)}
        >
         Question LangGraph
        </button>
      </div>
      </div>
      {isLangChainUploadOpen && (
        <RagLangChainUpload
          onClose={() => setIsLangChainUploadOpen(false)}
        />
      )}
      
      {isLangChainQueryOpen && (
        <RagLangChainQuery
          onClose={() => setIsLangChainQueryOpen(false)}
        />
      )}

      {isLangGraphUploadOpen && (
        <RagLangGraphUpload
          onClose={() => setIsLangGraphUploadOpen(false)}
        />
      )}
    
      {isLangGraphQueryOpen && (
        <RagLangGraphQuery
          onClose={() => setIsLangGraphQueryOpen(false)}
        />
      )}

      {isPopupOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePopup();
          }}
        >
          <div
            className="upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
          >
            <div className="modal-header">
              <h2 id="upload-modal-title">Upload Document</h2>

              <button
                type="button"
                className="close-btn"
                onClick={closePopup}
                disabled={loading}
                aria-label="Close popup"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <label htmlFor="pdf-file">Choose a PDF file</label>

              <input
                id="pdf-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                disabled={loading}
              />

              {file && (
                <div className="selected-file">
                  <p><strong>File:</strong> {file.name}</p>
                  <p><strong>Size:</strong> {formatSize(file.size)}</p>
                  <p><strong>Type:</strong> {file.type || "PDF"}</p>
                </div>
              )}

              {error && (
                <div className="upload-error" role="alert">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closePopup}
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="upload-btn"
                  disabled={loading || !file}
                >
                  {loading ? "Uploading..." : "Upload File"}
                </button>
              </div>
            </form>

            {loading && (
              <p className="upload-status" role="status">
                Uploading your document. Please wait...
              </p>
            )}

            {response && (
              <div className="upload-success" role="status">
                <h3>Upload Successful!</h3>

                <p>
                  <strong>File:</strong> {response.uploadedFileName}
                </p>
                <p>
                  <strong>Size:</strong>{" "}
                  {formatSize(response.uploadedFileSize)}
                </p>

                <h4>API Response</h4>

                <pre>
                  {JSON.stringify(response, null, 2)}
                </pre>

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closePopup}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isQueryOpen && (
        <div
          className="query-popup-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsQueryOpen(false);
            }
          }}
        >
          <div className="query-popup">
            <RagQuery
              onClose={() => setIsQueryOpen(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
