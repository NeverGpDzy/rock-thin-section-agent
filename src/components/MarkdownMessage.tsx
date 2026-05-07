import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const MarkdownMessage = ({
  content,
  inverted = false,
}: {
  content: string;
  inverted?: boolean;
}) => (
  <div
    className={`markdown-message${inverted ? " markdown-message--inverted" : ""}`}
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => (
          <a {...props} rel="noreferrer" target="_blank" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
