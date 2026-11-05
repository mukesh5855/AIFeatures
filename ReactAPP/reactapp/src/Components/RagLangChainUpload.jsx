
import { useState } from "react";

export default function RagLangChainUpload({ onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    setFile(null);
    setError("");
    setResponse(null);

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

    if (!file || loading) return;

    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const apiResponse = await fetch(
        "http://127.0.0.1:8000/LangChainRag/upload-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      const contentType =
        apiResponse.headers.get("content-type") || "";

      const data = contentType.includes("application/json")
        ? await apiResponse.json()
        : await apiResponse.text();

      if (!apiResponse.ok) {
        const detail =
          typeof data === "object" && data !== null
            ? data.detail || data.message
            : data;

        throw new Error(
          typeof detail === "string"
            ? detail
            : `Upload failed: HTTP ${apiResponse.status}`
        );
      }

      setResponse(data);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Unable to connect to FastAPI. Check the backend and CORS."
          : err.message || "PDF upload failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="lc-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="lc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lc-upload-title"
      >
        <div className="lc-modal-header">
          <h2 id="lc-upload-title">Upload PDF - LangChain</h2>

          <button
            type="button"
            className="lc-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close upload popup"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleUpload}>
          <label htmlFor="lc-pdf-file">
            Select a PDF document
          </label>

          <input
            id="lc-pdf-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            disabled={loading}
          />

          {file && (
            <div className="lc-file-info">
              <p><strong>File:</strong> {file.name}</p>
              <p>
                <strong>Size:</strong>{" "}
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}

          {error && (
            <p className="lc-error" role="alert">{error}</p>
          )}

          {response !== null && (
            <div className="lc-success" role="status">
              <h3>Upload successful!</h3>
              <pre>{JSON.stringify(response, null, 2)}</pre>
            </div>
          )}

          <div className="lc-modal-actions">
            <button
              type="button"
              className="lc-cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </button>

            <button
              type="submit"
              className="lc-submit-btn"
              disabled={!file || loading}
            >
              {loading ? "Uploading..." : "Upload PDF"}
            </button>
          </div>

          {loading && (
            <p role="status">Uploading and processing document...</p>
          )}
        </form>
      </div>
    </div>
  );
}
