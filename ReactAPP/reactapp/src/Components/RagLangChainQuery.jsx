
import { useEffect, useRef, useState } from "react";

export default function RagLangChainQuery({ onClose }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const prompt = question.trim();
    if (!prompt || loading) return;

    setQuestion("");
    setError("");

    setMessages((previous) => [
      ...previous,
      { role: "user", content: prompt },
    ]);

    setLoading(true);

    try {
      const apiResponse = await fetch(
        "http://127.0.0.1:8000/LangChainRag/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question: prompt }),
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
            : `Query failed: HTTP ${apiResponse.status}`
        );
      }

      const answer =
        typeof data === "string"
          ? data
          : data.answer ?? data.response ?? data.result ?? data;

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            typeof answer === "string"
              ? answer
              : JSON.stringify(answer, null, 2),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Unable to connect to FastAPI. Check the backend and CORS."
          : err.message || "Unable to process your question."
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
        className="lc-modal lc-query-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lc-query-title"
      >
        <div className="lc-modal-header">
          <h2 id="lc-query-title">Ask Questions - LangChain</h2>

          <button
            type="button"
            className="lc-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close query popup"
          >
            &times;
          </button>
        </div>

        <div className="lc-chat-messages" aria-live="polite">
          {messages.length === 0 && (
            <p className="lc-chat-empty">
              Ask a question about your uploaded PDF documents.
            </p>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`lc-chat-message ${
                message.role === "user"
                  ? "lc-user-message"
                  : "lc-assistant-message"
              }`}
            >
              <strong>
                {message.role === "user" ? "You" : "LangChain"}
              </strong>

              <pre>{message.content}</pre>
            </div>
          ))}

          {loading && (
            <p className="lc-loading" role="status">
              Searching documents and generating an answer...
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="lc-error" role="alert">{error}</p>
        )}

        <form className="lc-query-form" onSubmit={handleSubmit}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Enter your question..."
            rows={3}
            disabled={loading}
            aria-label="Your question"
          />

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
              disabled={loading || !question.trim()}
            >
              {loading ? "Processing..." : "Ask Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
