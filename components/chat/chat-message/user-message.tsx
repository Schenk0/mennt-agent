import { isFileUIPart, type UIMessage } from "ai";
import Image from "next/image";


export function UserMessage({ message }: { message: UIMessage }) {
  const fileParts = message.parts.filter(
    (p) => isFileUIPart(p) && p.mediaType.startsWith("image/")
  );
  const textParts = message.parts.filter((p) => p.type === "text");

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">
        {fileParts.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {fileParts.map((part, i) =>
              isFileUIPart(part) ? (
                <Image
                  key={i}
                  src={part.url}
                  alt={part.filename ?? "Image"}
                  className="max-h-40 rounded-md"
                  width={160}
                  height={160}
                />
              ) : null
            )}
          </div>
        )}
        {textParts.map((part, i) =>
          part.type === "text" ? (
            <span key={i} className="whitespace-pre-wrap">
              {part.text}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}