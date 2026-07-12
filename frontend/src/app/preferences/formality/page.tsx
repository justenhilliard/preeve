"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthenticatedApi } from "../../apiClient";
import { FORMALITY_OPTIONS, usePreferences } from "../preferencesContext";
import type {
  PreferencesPayload,
  PreferencesResponse,
} from "../preferencesContext";
import {
  formatOptionLabel,
  OptionButton,
  PrimaryAction,
  StepShell,
} from "../components";

export default function PreferencesFormalityPage() {
  const authenticatedApi = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const {
    errorMessage,
    formalityPreference,
    isLoading,
    preferredColors,
    preferredFits,
    setFormalityPreference,
  } = usePreferences();

  const savePreferencesMutation = useMutation({
    mutationFn: (preferencesPayload: PreferencesPayload) =>
      authenticatedApi<PreferencesResponse>("/api/preferences", {
        body: JSON.stringify(preferencesPayload),
        method: "PUT",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["preferences"] });
      router.push("/");
    },
  });
  const mutationErrorMessage = savePreferencesMutation.error?.message ?? null;

  return (
    <StepShell
      backHref="/preferences/fit"
      errorMessage={errorMessage ?? mutationErrorMessage}
      isLoading={isLoading}
      step={3}
      subtitle="Pick the one that feels most like your everyday style."
      title="What's your everyday vibe?"
    >
      <div className="space-y-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {FORMALITY_OPTIONS.map((formality) => (
            <OptionButton
              isSelected={formalityPreference === formality}
              key={formality}
              onClick={() => setFormalityPreference(formality)}
            >
              {formatOptionLabel(formality)}
            </OptionButton>
          ))}
        </div>

        <div className="flex justify-end">
          <PrimaryAction
            disabled={savePreferencesMutation.isPending}
            onClick={() =>
              savePreferencesMutation.mutate({
                formalityPreference,
                preferredColors,
                preferredFits,
              })
            }
          >
            See my style profile
          </PrimaryAction>
        </div>
      </div>
    </StepShell>
  );
}
