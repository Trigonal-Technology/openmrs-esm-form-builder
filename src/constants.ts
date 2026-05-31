import type { RenderType } from '@openmrs/esm-form-engine-lib';

export const questionTypes = [
  'control',
  'encounterDatetime',
  'encounterLocation',
  'encounterProvider',
  'encounterRole',
  'obs',
  'obsGroup',
  'patientIdentifier',
  'personAttribute',
  'testOrder',
  'programState',
] as const;

export type QuestionType = (typeof questionTypes)[number];

export const renderingTypes: Array<RenderType> = [
  'checkbox',
  'checkbox-searchable',
  'content-switcher',
  'date',
  'datetime',
  'drug',
  'encounter-location',
  'encounter-provider',
  'encounter-role',
  'fixed-value',
  'file',
  'group',
  'number',
  'problem',
  'radio',
  'repeating',
  'select',
  'text',
  'textarea',
  'toggle',
  'ui-select-extended',
  'workspace-launcher',
  'markdown',
  'extension-widget',
  'select-concept-answers',
];

// Render types that are ONLY valid for obs questions — must not appear under
// encounter or any other question type's rendering picker.
export const obsOnlyRenderingTypes: Array<RenderType> = ['bed-select', 'multi-provider-select'];

export const renderTypeOptions: Record<QuestionType, Array<RenderType>> = {
  control: ['text', 'markdown'],
  encounterDatetime: ['date', 'datetime'],
  encounterLocation: ['ui-select-extended'],
  encounterProvider: ['ui-select-extended'],
  encounterRole: ['ui-select-extended'],
  obs: [...renderingTypes, ...obsOnlyRenderingTypes],
  obsGroup: ['group', 'repeating'],
  personAttribute: ['text', 'select', 'date', 'radio', 'checkbox', 'textarea', 'toggle', 'ui-select-extended'],
  testOrder: ['group', 'repeating'],
  patientIdentifier: ['text'],
  programState: ['select'],
};
