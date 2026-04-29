import { useCallback } from "react";
import Editor, { loader } from "@monaco-editor/react";

loader.config({ paths: { vs: "/assets/monaco/vs" } });

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onReady?: () => void;
  id?: string;
};

export function MarkdownEditor({ value, onChange, onReady, id }: MarkdownEditorProps) {
  const handleChange = useCallback(
    (nextValue?: string) => {
      onChange(nextValue ?? "");
    },
    [onChange],
  );

  return (
    <div
      id={id}
      className="h-[min(22rem,40vh)] min-h-[12rem] w-full shrink-0 overflow-hidden rounded-lg border border-frosted bg-background"
    >
      <Editor
        height="100%"
        value={value}
        language="markdown"
        theme="vs-dark"
        onChange={handleChange}
        onMount={() => onReady?.()}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
        }}
      />
    </div>
  );
}
