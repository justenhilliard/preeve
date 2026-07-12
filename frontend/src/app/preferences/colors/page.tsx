"use client";

import {
  COLOR_OPTIONS,
  COLOR_SWATCHES,
  usePreferences,
} from "../preferencesContext";
import { ColorSwatchButton, PrimaryLink, StepShell } from "../components";

export default function PreferencesColorsPage() {
  const {
    errorMessage,
    isLoading,
    preferredColors,
    toggleColor,
  } = usePreferences();

  return (
    <StepShell
      backHref="/"
      errorMessage={errorMessage}
      isLoading={isLoading}
      step={1}
      subtitle="Pick as many as you want."
      title="What colors do you love wearing?"
    >
      <div className="space-y-8">
        <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
          {COLOR_OPTIONS.map((color) => (
            <ColorSwatchButton
              colorName={color}
              hex={COLOR_SWATCHES[color]}
              isSelected={preferredColors.includes(color)}
              key={color}
              onClick={() => toggleColor(color)}
            />
          ))}
        </div>

        <div className="flex justify-end">
          <PrimaryLink href="/preferences/fit">Continue</PrimaryLink>
        </div>
      </div>
    </StepShell>
  );
}
