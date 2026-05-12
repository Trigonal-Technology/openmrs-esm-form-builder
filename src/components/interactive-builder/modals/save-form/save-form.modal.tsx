import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Button,
  ComposedModal,
  Form as CarbonForm,
  FormGroup,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import { navigate, showSnackbar } from '@openmrs/esm-framework';
import { useEncounterTypes } from '@hooks/useEncounterTypes';
import { useForm } from '@hooks/useForm';
import {
  deleteClobdata,
  deleteForm,
  deleteResource,
  getResourceUuid,
  saveNewForm,
  schemaWithoutFormRulesForClobdataUpload,
  updateForm,
  uploadSchema,
} from '@resources/forms.resource';
import type { Form, Schema } from '@types';
import {
  FORM_VISIBILITY_RULE_KEYS,
  getFormRulesDisplayText,
  isFormRulesValidationFailure,
  validateFormRulesText,
} from '../../../../utils/form-rules-validation';
import styles from './save-form.scss';

interface SaveFormModalProps {
  form?: Form;
  schema?: Schema;
  /** Raw schema JSON from the editor — `formRules` is read from here when present. */
  stringifiedSchema: string;
}

const SaveFormModal: React.FC<SaveFormModalProps> = ({ form, schema, stringifiedSchema }) => {
  const { t } = useTranslation();
  const { encounterTypes } = useEncounterTypes();
  const { formUuid } = useParams<{ formUuid: string }>();
  const { mutate } = useForm(formUuid);
  const isSavingNewForm = !formUuid;
  const [description, setDescription] = useState('');
  const [encounterType, setEncounterType] = useState('');
  const [isInvalidVersion, setIsInvalidVersion] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [name, setName] = useState('');
  const [openConfirmSaveModal, setOpenConfirmSaveModal] = useState(false);
  const [openSaveFormModal, setOpenSaveFormModal] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [version, setVersion] = useState('');
  const [formRulesText, setFormRulesText] = useState('');
  const [formRulesError, setFormRulesError] = useState<string | undefined>();
  const saveModalWasOpen = useRef(false);

  const clearDraftFormSchema = useCallback(() => localStorage.removeItem('formJSON'), []);

  useEffect(() => {
    if (schema) {
      setName(schema.name);
      setDescription(schema.description);
      setEncounterType(schema.encounterType);
      setVersion(schema.version);
    }
  }, [schema]);

  /** When the save modal opens, pre-fill rules from schema editor JSON, then parsed schema. */
  useEffect(() => {
    if (openSaveFormModal) {
      if (!saveModalWasOpen.current) {
        const display = getFormRulesDisplayText(stringifiedSchema, schema);
        setFormRulesText(display);
        const initial = validateFormRulesText(display);
        if (isFormRulesValidationFailure(initial)) {
          setFormRulesError(initial.error);
        } else {
          setFormRulesError(undefined);
        }
      }
      saveModalWasOpen.current = true;
    } else {
      saveModalWasOpen.current = false;
    }
  }, [openSaveFormModal, stringifiedSchema, schema]);

  const onFormRulesChange = useCallback((value: string) => {
    setFormRulesText(value);
    const result = validateFormRulesText(value);
    if (isFormRulesValidationFailure(result)) {
      setFormRulesError(result.error);
    } else {
      setFormRulesError(undefined);
    }
  }, []);

  const formRulesBlockingSave = Boolean(formRulesText.trim() && formRulesError);

  const checkVersionValidity = (version: string) => {
    if (!version) return setIsInvalidVersion(false);

    setIsInvalidVersion(!/^[0-9]/.test(version));
  };

  const openModal = useCallback((option: string) => {
    if (option === 'newVersion') {
      setSaveState('newVersion');
      setOpenConfirmSaveModal(false);
      setOpenSaveFormModal(true);
    } else if (option === 'new') {
      setSaveState('newVersion');
      setOpenSaveFormModal(true);
    } else if (option === 'update') {
      setSaveState('update');
      setOpenConfirmSaveModal(false);
      setOpenSaveFormModal(true);
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schema) {
      return;
    }
    setIsSavingForm(true);

    const target = event.target as EventTarget & {
      name: { value: string };
      version: { value: string };
      encounterType: { value: string };
      description: { value: string };
    };

    let parsedFormRules: unknown | null;
    const rulesResult = validateFormRulesText(formRulesText);
    if (isFormRulesValidationFailure(rulesResult)) {
      showSnackbar({
        title: t('invalidFormRulesJson', 'Invalid form rules JSON'),
        kind: 'error',
        subtitle: rulesResult.error,
      });
      setIsSavingForm(false);
      return;
    }
    parsedFormRules = rulesResult.value;

    if (saveState === 'new' || saveState === 'newVersion') {
      const name = target.name.value,
        version = target.version.value,
        encounterType = target.encounterType.value,
        description = target.description.value;

      try {
        const newForm = await saveNewForm(name, version, false, description, encounterType, parsedFormRules);

        const updatedSchema: Schema = {
          ...schema,
          name: name,
          version: version,
          description: description,
          encounterType: encounterType,
          uuid: newForm.uuid,
        };
        if (parsedFormRules !== null) {
          updatedSchema.formRules = parsedFormRules as Schema['formRules'];
        } else {
          delete updatedSchema.formRules;
        }

        let newValueReference: string | undefined;
        try {
          newValueReference = (await uploadSchema(schemaWithoutFormRulesForClobdataUpload(updatedSchema))).toString();
          await getResourceUuid(newForm.uuid, newValueReference);
        } catch (error) {
          // Clean up the orphaned clobdata and form since schema upload or linking failed
          if (newValueReference) {
            await deleteClobdata(newValueReference).catch(() => {});
          }
          await deleteForm(newForm.uuid).catch(() => {});
          throw error;
        }

        showSnackbar({
          title: t('formCreated', 'New form created'),
          kind: 'success',
          isLowContrast: true,
          subtitle:
            name + ' ' + t('saveSuccessMessage', 'was created successfully. It is now visible on the Forms dashboard.'),
        });
        clearDraftFormSchema();
        setOpenSaveFormModal(false);
        await mutate();

        navigate({
          to: `${window.spaBase}/form-builder/edit/${newForm.uuid}`,
        });

        setIsSavingForm(false);
      } catch (error) {
        if (error instanceof Error) {
          showSnackbar({
            title: t('errorCreatingForm', 'Error creating form'),
            kind: 'error',
            subtitle: error?.message,
          });
        }
        setIsSavingForm(false);
      }
    } else {
      try {
        if (!form?.uuid) {
          throw new Error('Missing form metadata');
        }

        const updatedSchema: Schema = {
          ...schema,
          name: name,
          version: version,
          description: description,
          encounterType: encounterType,
        };
        if (parsedFormRules !== null) {
          updatedSchema.formRules = parsedFormRules as Schema['formRules'];
        } else {
          delete updatedSchema.formRules;
        }

        await updateForm(form.uuid, name, version, description, encounterType, parsedFormRules);

        const oldResource = form?.resources?.length
          ? form.resources.find(({ name }) => name === 'JSON schema')
          : undefined;

        // Upload the new clobdata first (doesn't affect the live form yet)
        const newValueReference = (
          await uploadSchema(schemaWithoutFormRulesForClobdataUpload(updatedSchema))
        ).toString();

        // Swap: remove old resource link, then link the new clobdata.
        // If the swap fails, clean up the newly uploaded clobdata.
        try {
          if (oldResource) {
            await deleteResource(form.uuid, oldResource.uuid);
          }
          await getResourceUuid(form.uuid, newValueReference);
        } catch (error) {
          await deleteClobdata(newValueReference).catch(() => {});
          throw error;
        }

        // Clean up old clobdata. If this fails, the form still works
        // (just an orphaned clobdata row in the database).
        if (oldResource) {
          await deleteClobdata(oldResource.valueReference).catch(() => {});
        }

        showSnackbar({
          title: t('success', 'Success!'),
          kind: 'success',
          isLowContrast: true,
          subtitle: form?.name + ' ' + t('saveSuccess', 'was updated successfully'),
        });
        setOpenSaveFormModal(false);
        await mutate();
        setIsSavingForm(false);
      } catch (error) {
        if (error instanceof Error) {
          showSnackbar({
            title: t('errorUpdatingForm', 'Error updating form'),
            kind: 'error',
            subtitle: error?.message,
          });
        }

        setIsSavingForm(false);
      }
    }
  };

  return (
    <>
      {!isSavingNewForm ? (
        <ComposedModal
          open={openConfirmSaveModal}
          onClose={() => setOpenConfirmSaveModal(false)}
          preventCloseOnClickOutside
        >
          <ModalHeader title={t('saveConfirmation', 'Save or Update form')} />
          <ModalBody>
            <p>
              {t(
                'saveAsModal',
                "A version of the form you're working on already exists on the server. Do you want to update the form or to save it as a new version?",
              )}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button kind={'tertiary'} onClick={() => openModal('update')}>
              {t('updateExistingForm', 'Update existing version')}
            </Button>
            <Button kind={'primary'} onClick={() => openModal('newVersion')}>
              {t('saveAsNewForm', 'Save as a new form')}
            </Button>
            <Button kind={'secondary'} onClick={() => setOpenConfirmSaveModal(false)}>
              {t('close', 'Close')}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}

      <ComposedModal open={openSaveFormModal} onClose={() => setOpenSaveFormModal(false)} preventCloseOnClickOutside>
        <ModalHeader title={t('saveFormToServer', 'Save form to server')} />
        <CarbonForm onSubmit={handleSubmit} className={styles.saveFormBody}>
          <ModalBody>
            <p>
              {t(
                'saveExplainerText',
                'Clicking the Save button saves your form schema to the database. To see your form in your frontend, you first need to publish it. Click the Publish button to publish your form.',
              )}
            </p>
            <FormGroup legendText={''}>
              <Stack gap={5}>
                <TextInput
                  id="name"
                  labelText={t('formName', 'Form Name')}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                  placeholder={t('formNamePlaceholder', 'e.g. OHRI Express Care Patient Encounter Form')}
                  required
                  value={name}
                />
                {saveState === 'update' ? (
                  <TextInput
                    id="uuid"
                    labelText={t('autogeneratedUuid', 'UUID (auto-generated)')}
                    disabled
                    value={form?.uuid}
                  />
                ) : null}
                <TextInput
                  id="version"
                  labelText={t('version', 'Version')}
                  placeholder={t('versionPlaceholder', 'e.g. 1.0')}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    checkVersionValidity(event.target.value);

                    if (!isInvalidVersion) {
                      setVersion(event.target.value);
                    }
                  }}
                  invalid={isInvalidVersion}
                  invalidText={t('invalidVersionWarning', 'Version can only start with with a number')}
                  required
                  value={version}
                />
                <Select
                  id="encounterType"
                  labelText={t('encounterType', 'Encounter Type')}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setEncounterType(event.target.value)}
                  required
                  value={encounterType}
                >
                  {!encounterType ? (
                    <SelectItem
                      text={t('chooseEncounterType', 'Choose an encounter type to link your form to')}
                      value=""
                    />
                  ) : null}
                  {encounterTypes?.length > 0 &&
                    encounterTypes.map((encounterType) => (
                      <SelectItem key={encounterType.uuid} value={encounterType.uuid} text={encounterType.name}>
                        {encounterType.name}
                      </SelectItem>
                    ))}
                </Select>
                <TextArea
                  labelText={t('description', 'Description')}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)}
                  id="description"
                  placeholder={t(
                    'descriptionPlaceholderText',
                    'e.g. A form used to collect encounter data for clients in the Express Care program.',
                  )}
                  required
                  value={description}
                />
                <TextArea
                  labelText={t('formRulesJson', 'Context / visibility rules (JSON)')}
                  helperText={t(
                    'formRulesHelper',
                    'Optional. Stored as server metadata (formRules). Only these keys are allowed: {{keys}}. Wrong types or extra keys are rejected.',
                    { keys: FORM_VISIBILITY_RULE_KEYS.join(', ') },
                  )}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onFormRulesChange(event.target.value)}
                  id="formRules"
                  placeholder={t('formRulesPlaceholder', '{"locationTags":["ER"],"visitTypeUuids":["…uuid…"]}')}
                  value={formRulesText}
                  rows={5}
                  invalid={Boolean(formRulesError)}
                  invalidText={formRulesError}
                />
              </Stack>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button kind={'secondary'} onClick={() => setOpenSaveFormModal(false)}>
              {t('close', 'Close')}
            </Button>
            <Button
              disabled={isSavingForm || isInvalidVersion || formRulesBlockingSave}
              className={styles.spinner}
              type={'submit'}
              kind={'primary'}
            >
              {isSavingForm ? (
                <InlineLoading description={t('saving', 'Saving') + '...'} />
              ) : (
                <span>{t('save', 'Save')}</span>
              )}
            </Button>
          </ModalFooter>
        </CarbonForm>
      </ComposedModal>

      <Button
        disabled={!schema}
        kind="primary"
        onClick={() => (isSavingNewForm ? openModal('new') : setOpenConfirmSaveModal(true))}
      >
        {t('saveForm', 'Save form')}
      </Button>
    </>
  );
};

export default SaveFormModal;
