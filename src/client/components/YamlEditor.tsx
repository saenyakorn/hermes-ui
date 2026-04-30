import { useCallback } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { cn } from "../lib/cn";

loader.config({ paths: { vs: "/assets/monaco/vs" } });

type YamlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onReady?: () => void;
  /** CSS height of the editor surface (default full stretch of parent). */
  height?: string | number;
  className?: string;
  id?: string;
};

export function YamlEditor({
  value,
  onChange,
  onReady,
  height = "100%",
  className,
  id,
}: YamlEditorProps) {
  const handleChange = useCallback(
    (nextValue?: string) => {
      onChange(nextValue ?? "");
    },
    [onChange],
  );

  const heightProp = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      {...(id !== undefined ? { id } : {})}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-frosted bg-background",
        className,
      )}
    >
      <Editor
        height={heightProp}
        value={value}
        language="yaml"
        theme="vs-dark"
        onChange={handleChange}
        onMount={() => onReady?.()}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
