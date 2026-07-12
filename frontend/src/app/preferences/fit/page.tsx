"use client";

import { FIT_OPTIONS, usePreferences } from "../preferencesContext";
import {
  formatOptionLabel,
  OptionButton,
  PrimaryLink,
  StepShell,
} from "../components";

export default function PreferencesFitPage() {
  const {
    errorMessage,
    isLoading,
    preferredFits,
    toggleFit,
  } = usePreferences();

  return (
    <StepShell
      backHref="/preferences/colors"
      errorMessage={errorMessage}
      isLoading={isLoading}
      step={2}
      subtitle="Pick as many as you want."
      title="What fits feel like you?"
    >
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {FIT_OPTIONS.map((fit) => (
            <OptionButton
              isSelected={preferredFits.includes(fit)}
              key={fit}
              onClick={() => toggleFit(fit)}
            >
              {formatOptionLabel(fit)}
            </OptionButton>
          ))}
        </div>

        <div className="flex justify-end">
          <PrimaryLink href="/preferences/formality">Continue</PrimaryLink>
        </div>
      </div>
    </StepShell>
  );
}
