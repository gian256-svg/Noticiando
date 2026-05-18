import { create } from "zustand";

interface ScriptStore {
  script: string;
  isGenerating: boolean;
  duration: number;
  error: string | null;

  setScript: (script: string) => void;
  appendScript: (chunk: string) => void;
  setGenerating: (generating: boolean) => void;
  setDuration: (duration: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useScriptStore = create<ScriptStore>((set) => ({
  script: "",
  isGenerating: false,
  duration: 45,
  error: null,

  setScript: (script) => set({ script }),
  appendScript: (chunk) => set((s) => ({ script: s.script + chunk })),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setDuration: (duration) => set({ duration }),
  setError: (error) => set({ error }),
  reset: () => set({ script: "", isGenerating: false, error: null }),
}));
