"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
import { useAuthenticatedApi } from "../apiClient";

export const COLOR_OPTIONS = [
  "black",
  "white",
  "gray",
  "navy",
  "blue",
  "red",
  "green",
  "olive",
  "brown",
  "tan",
  "beige",
  "pink",
  "purple",
  "yellow",
  "orange",
  "burgundy",
  "multicolor",
] as const;

export const FIT_OPTIONS = [
  "baggy",
  "oversized",
  "relaxed",
  "cropped",
  "fitted",
  "slim",
  "tailored",
  "straight",
] as const;

export const FORMALITY_OPTIONS = [
  "athleisure",
  "casual",
  "smart_casual",
  "business_casual",
  "formal",
] as const;

export type ColorOption = (typeof COLOR_OPTIONS)[number];
export type FitOption = (typeof FIT_OPTIONS)[number];
export type FormalityOption = (typeof FORMALITY_OPTIONS)[number];

export const COLOR_SWATCHES: Record<ColorOption, string> = {
  black: "#1F1A17",
  white: "#F8F5EF",
  gray: "#8D8780",
  navy: "#24334F",
  blue: "#496E9D",
  red: "#A94C3F",
  green: "#5D7A5B",
  olive: "#6F7651",
  brown: "#7A563D",
  tan: "#C2A27A",
  beige: "#D8C8AA",
  pink: "#CFA7A4",
  purple: "#7C668B",
  yellow: "#D1AE58",
  orange: "#BF7548",
  burgundy: "#733E46",
  // Conic gradient reads as a color wheel on the circular swatch, built from
  // hues already in the palette above so it stays cohesive with the rest.
  multicolor:
    "conic-gradient(from 180deg, #A94C3F, #D1AE58, #5D7A5B, #496E9D, #7C668B, #A94C3F)",
};

export type PreferencesPayload = {
  preferredColors: ColorOption[];
  preferredFits: FitOption[];
  formalityPreference: FormalityOption | null;
};

export type PreferencesResponse = PreferencesPayload & {
  updatedAt: string | null;
};

type PreferencesContextValue = PreferencesPayload & {
  isLoading: boolean;
  errorMessage: string | null;
  setFormalityPreference: (value: FormalityOption) => void;
  toggleColor: (value: ColorOption) => void;
  toggleFit: (value: FitOption) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const EMPTY_PREFERENCES: PreferencesPayload = {
  formalityPreference: null,
  preferredColors: [],
  preferredFits: [],
};

function toggleSelectedValue<Value extends string>(
  selectedValues: Value[],
  value: Value,
) {
  if (selectedValues.includes(value)) {
    return selectedValues.filter((selectedValue) => selectedValue !== value);
  }

  return [...selectedValues, value];
}

export function PreferencesProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authenticatedApi = useAuthenticatedApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [draftPreferences, setDraftPreferences] =
    useState<PreferencesPayload | null>(null);

  const preferencesQuery = useQuery({
    enabled: isLoaded && Boolean(isSignedIn),
    queryKey: ["preferences"],
    queryFn: () => authenticatedApi<PreferencesResponse>("/api/preferences"),
  });

  const savedPreferences = preferencesQuery.data ?? EMPTY_PREFERENCES;
  const activePreferences = draftPreferences ?? savedPreferences;

  const contextValue = useMemo<PreferencesContextValue>(
    () => ({
      errorMessage:
        preferencesQuery.error instanceof Error
          ? preferencesQuery.error.message
          : null,
      formalityPreference: activePreferences.formalityPreference,
      isLoading: preferencesQuery.isLoading,
      preferredColors: activePreferences.preferredColors,
      preferredFits: activePreferences.preferredFits,
      setFormalityPreference: (value) => {
        setDraftPreferences((currentDraft) => ({
          ...(currentDraft ?? activePreferences),
          formalityPreference: value,
        }));
      },
      toggleColor: (value) => {
        setDraftPreferences((currentDraft) => {
          const currentPreferences = currentDraft ?? activePreferences;

          return {
            ...currentPreferences,
            preferredColors: toggleSelectedValue(
              currentPreferences.preferredColors,
              value,
            ),
          };
        });
      },
      toggleFit: (value) => {
        setDraftPreferences((currentDraft) => {
          const currentPreferences = currentDraft ?? activePreferences;

          return {
            ...currentPreferences,
            preferredFits: toggleSelectedValue(
              currentPreferences.preferredFits,
              value,
            ),
          };
        });
      },
    }),
    [
      activePreferences,
      preferencesQuery.error,
      preferencesQuery.isLoading,
    ],
  );

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const contextValue = useContext(PreferencesContext);
  if (contextValue === null) {
    throw new Error("usePreferences must be used inside PreferencesProvider.");
  }

  return contextValue;
}
