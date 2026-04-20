export function Loading() {
  return (
    <div className="flex">
      <div className="flex items-center justify-center space-x-2">
        <div className="size-3 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
        <div className="size-3 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
        <div className="size-3 animate-bounce rounded-full bg-primary"></div>
      </div>
    </div>
  );
}