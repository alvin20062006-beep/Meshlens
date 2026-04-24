"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project } from "@/lib/types";

type JobUIStatus = "idle" | "running" | "completed" | "failed";

type UIState = {
  currentProject: Project | null;
  credits: number;
  currentJobId: string | null;
  currentJobStatus: JobUIStatus;
  currentJobError: string | null;
  setProject: (project: Project) => void;
  deductCredits: (amount: number) => void;
  setCurrentJob: (jobId: string | null, status?: JobUIStatus, error?: string | null) => void;
  clearCurrentJob: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      currentProject: null,
      credits: 100,
      currentJobId: null,
      currentJobStatus: "idle",
      currentJobError: null,
      setProject: (project) => set({ currentProject: project }),
      deductCredits: (amount) =>
        set((s) => ({ credits: Math.max(0, (s.credits ?? 0) - (amount ?? 0)) })),
      setCurrentJob: (jobId, status, error) =>
        set({
          currentJobId: jobId,
          currentJobStatus: status ?? "idle",
          currentJobError: error ?? null,
        }),
      clearCurrentJob: () =>
        set({
          currentJobId: null,
          currentJobStatus: "idle",
          currentJobError: null,
        }),
    }),
    {
      name: "meshlens-ui",
    }
  )
);

