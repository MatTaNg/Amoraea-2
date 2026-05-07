import { useEffect, useRef } from 'react';
import { nominatimSearchPlaces } from '@/shared/utils/nominatimSearch';

export type LocationSuggestion = { label: string };

export type UseLocationAutocompleteParams = {
  value: string;
  validatedValue?: string;
  onSuggestionsChange: (suggestions: LocationSuggestion[]) => void;
  /** Minimum query length before calling the API. Default 2. */
  minLength?: number;
  debounceMs?: number;
};

/**
 * Fetches place suggestions as the user types (OpenStreetMap Nominatim).
 * Callers should clear `validatedValue` when the text field diverges from the last selection.
 */
export function useLocationAutocomplete({
  value,
  validatedValue,
  onSuggestionsChange,
  minLength = 2,
  debounceMs = 550,
}: UseLocationAutocompleteParams): void {
  const onSuggestionsRef = useRef(onSuggestionsChange);
  onSuggestionsRef.current = onSuggestionsChange;

  useEffect(() => {
    const q = value.trim();
    if (q.length < minLength) {
      onSuggestionsRef.current([]);
      return undefined;
    }
    const validated = validatedValue?.trim() ?? '';
    if (validated !== '' && q === validated) {
      onSuggestionsRef.current([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await nominatimSearchPlaces(q);
          if (!cancelled) {
            onSuggestionsRef.current(results);
          }
        } catch {
          if (!cancelled) {
            onSuggestionsRef.current([]);
          }
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, validatedValue, minLength, debounceMs]);
}
