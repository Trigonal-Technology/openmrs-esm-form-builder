import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Concept } from '@types';

/**
 * Looks up concepts by name/UUID.
 *
 * `v=full` is used so each result emits its own full representation: a ConceptComplex includes its
 * `handler` string, while plain concepts simply omit it (requesting `handler` via a custom rep would
 * throw `Unknown property: handler` on non-complex results and fail the whole search).
 *
 * @param conceptId search term (concept name or UUID)
 * @param handler when provided, restricts results to ConceptComplex concepts whose complex-obs
 *   handler equals this string (e.g. `NidanBedHandler`, `NidanProviderHandler`).
 */
export function useConceptLookup(conceptId: string, handler?: string) {
  const url = `${restBaseUrl}/concept?q=${conceptId}&v=full`;

  const { data, error, isLoading } = useSWR<{ data: { results: Array<Concept> } }, Error>(
    conceptId ? url : null,
    openmrsFetch,
  );

  const results = data?.data?.results ?? [];

  return {
    concepts: handler ? results.filter((concept) => concept.handler === handler) : results,
    conceptLookupError: error,
    isLoadingConcepts: isLoading,
  };
}
