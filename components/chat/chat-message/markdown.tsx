import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function parseMarkdownIntoBlocks(markdown: string) {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-semibold mt-4 mb-1.5">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-[0.95rem] font-semibold mt-3 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2.5 mb-1">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="leading-relaxed not-only:not-last:mb-2.5">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-4 mb-2 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-4 mb-2 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        code: ({ children, ...props }: React.ComponentProps<"code">) => (
          <code
            className="bg-background/60 px-1 py-0.5 rounded text-[0.8em] font-mono"
            {...props}
          >
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-background/60 rounded-md p-3 my-2 overflow-x-auto text-[0.8em] font-mono">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 my-2 opacity-85">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border" />,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  ),
  (prev, next) => prev.content === next.content
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return blocks.map((block, index) => (
      <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
    ));
  }
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
