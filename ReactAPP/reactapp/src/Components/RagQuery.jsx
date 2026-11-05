
import { useState, useRef, useEffect } from "react";
import "./RagQuery.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const QUERY_ENDPOINT = `${API_BASE_URL}/documents/query`;

export default function RagQuery({ onClose }) {
  const [isOpen, setIsOpen] = useState(true);
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

    const previousMessages = messages;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const history = previousMessages.map(({ role, content }) => ({
        role,
        content,
      }));

      const apiResponse = await fetch(QUERY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: prompt,
          history,
        }),
      });

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
            : `Query failed (${apiResponse.status}).`
        );
      }

      const answer =
        typeof data === "string"
          ? data
          : data.answer ??
            data.response ??
            data.result ??
            JSON.stringify(data, null, 2);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            typeof answer === "string"
              ? answer
              : JSON.stringify(answer, null, 2),
          apiResponse: data,
        },
      ]);
    } catch (err) {
      console.error("Query API error:", err);

      setError(
        err instanceof TypeError
          ? "Unable to connect to FastAPI. Check the server and CORS settings."
          : err.message || "Failed to get an answer. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const closeChat = () => {
    if (loading) return;

       onClose?.();
  };

  const clearChat = () => {
    if (loading) return;
    setMessages([]);
    setError("");
    setQuestion("");
  };

  return (
    <section className="query-page">
      <div
            className="query-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="query-title"
          >
            <header className="query-header">
              <div>
                <h2 id="query-title">Document AI Chat</h2>
                <p>Ask questions about your documents</p>
              </div>

              <button
                type="button"
                className="query-close-btn"
                onClick={closeChat}
                disabled={loading}
                aria-label="Close chat"
              >
                &times;
              </button>
            </header>

            <div className="query-toolbar">
              <span>{messages.length} messages</span>
              <button
                type="button"
                onClick={clearChat}
                disabled={loading || messages.length === 0}
              >
                Clear chat
              </button>
            </div>

            <div className="query-messages" aria-live="polite">
              {messages.length === 0 && (
                <div className="query-empty">
                  <h3>How can I help?</h3>
                  <p>Enter a question below to get started.</p>
                </div>
              )}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`query-message ${
                    message.role === "user"
                      ? "query-user"
                      : "query-assistant"
                  }`}
                >
                  <strong>
                    {message.role === "user" ? "You" : "Assistant"}
                  </strong>

                  <div className="query-message-content">
                    {message.content}
                  </div>

                  {message.apiResponse !== undefined && (
                    <details className="query-response-details">
                      <summary>View full API response</summary>
                      <pre>
                        {JSON.stringify(
                          message.apiResponse,
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  )}
                </article>
              ))}

              {loading && (
                <div className="query-message query-assistant">
                  <strong>Assistant</strong>
                  <p>Searching documents and generating an answer...</p>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {error && (
              <div className="query-error" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  &times;
                </button>
              </div>
            )}

            <form className="query-form" onSubmit={handleSubmit}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask something about your documents..."
                rows={2}
                disabled={loading}
                aria-label="Enter your question"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />

              <button
                type="submit"
                disabled={loading || !question.trim()}
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </form>

            <footer className="query-footer">
              Press Enter to send · Shift + Enter for a new line
            </footer>
        </div>
    </section>
  );
}
