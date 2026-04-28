import { useCallback } from "react";
import Editor, { loader } from "@monaco-editor/react";

loader.config({ paths: { vs: "/assets/monaco/vs" } });

type YamlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onReady?: () => void;
};

export function YamlEditor({ value, onChange, onReady }: YamlEditorProps) {
  const handleChange = useCallback(
    (nextValue?: string) => {
      onChange(nextValue ?? "");
    },
    [onChange],
  );

  return (
    <div
      id="config-editor"
      className="min-h-[280px] flex-1 overflow-hidden rounded-lg border border-frosted bg-background"
    >
      <Editor
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
