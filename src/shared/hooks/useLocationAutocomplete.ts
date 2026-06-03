import { useEffect, useRef, useState } from 'react';
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
}: UseLocationAutocompleteParams): { isSearchingPlaces: boolean } {
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const onSuggestionsRef = useRef(onSuggestionsChange);
  onSuggestionsRef.current = onSuggestionsChange;

  useEffect(() => {
    let cancelled = false;
    const q = value.trim();
    if (q.length < minLength) {
      onSuggestionsRef.current([]);
      setIsSearchingPlaces(false);
      return () => {
        cancelled = true;
      };
    }
    const validated = validatedValue?.trim() ?? '';
    if (validated !== '' && q === validated) {
      onSuggestionsRef.current([]);
      setIsSearchingPlaces(false);
      return () => {
        cancelled = true;
      };
    }

    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        setIsSearchingPlaces(true);
        try {
          const results = await nominatimSearchPlaces(q);
          if (!cancelled) {
            onSuggestionsRef.current(results);
          }
        } catch {
          if (!cancelled) {
            onSuggestionsRef.current([]);
          }
        } finally {
          if (!cancelled) {
            setIsSearchingPlaces(false);
          }
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsSearchingPlaces(false);
    };
  }, [value, validatedValue, minLength, debounceMs]);

  return { isSearchingPlaces };
}
