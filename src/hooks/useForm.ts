import useSWR from 'swr/immutable';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Form } from '@types';

export const useForm = (uuid?: string | null) => {
  const url = uuid ? `${restBaseUrl}/form/${uuid}?v=full` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Form }, Error>(url, openmrsFetch);

  return {
    form: data?.data,
    formError: error,
    isLoadingForm: isLoading,
    isValidatingForm: isValidating,
    mutate,
  };
};
