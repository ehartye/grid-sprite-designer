import { useState, useCallback } from 'react';

export interface PosterizeSettings {
  posterizeBits: number;
  posterizeOutput: boolean;
}

export interface PosterizeActions {
  setPosterizeBits: (v: number) => void;
  setPosterizeOutput: (v: boolean) => void;
  resetPosterize: () => void;
  restorePosterize: (settings: Partial<PosterizeSettings>) => void;
}

const DEFAULTS: PosterizeSettings = {
  posterizeBits: 4,
  posterizeOutput: false,
};

export function usePosterizeSettings(): PosterizeSettings & PosterizeActions {
  const [posterizeBits, setPosterizeBits] = useState(DEFAULTS.posterizeBits);
  const [posterizeOutput, setPosterizeOutput] = useState(DEFAULTS.posterizeOutput);

  const resetPosterize = useCallback(() => {
    setPosterizeBits(DEFAULTS.posterizeBits);
    setPosterizeOutput(DEFAULTS.posterizeOutput);
  }, []);

  const restorePosterize = useCallback((settings: Partial<PosterizeSettings>) => {
    if (settings.posterizeBits !== undefined) setPosterizeBits(settings.posterizeBits);
    if (settings.posterizeOutput !== undefined) setPosterizeOutput(settings.posterizeOutput);
  }, []);

  return {
    posterizeBits, setPosterizeBits,
    posterizeOutput, setPosterizeOutput,
    resetPosterize,
    restorePosterize,
  };
}
