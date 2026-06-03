import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import UnsavedChangesModal from '../components/UnsavedChangesModal';

type SaveHandler = () => void | Promise<boolean | void>;

type Options = {
  hasUnsavedChanges: boolean;
  /** When provided, modal offers Save. Should return true if save succeeded. */
  onSave?: SaveHandler;
  title?: string;
  message?: string;
};

export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  onSave,
  title = 'Save before you go?',
  message = 'You have unsaved changes. Save them now or keep editing.',
}: Options) {
  const navigation = useNavigation();
  const isPromptingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const leaveActionRef = useRef<(() => void) | null>(null);

  const closePrompt = useCallback(() => {
    setVisible(false);
    setSaving(false);
    isPromptingRef.current = false;
    leaveActionRef.current = null;
  }, []);

  const showLeavePrompt = useCallback(
    (leaveAction: () => void) => {
      if (isPromptingRef.current) return;
      isPromptingRef.current = true;
      leaveActionRef.current = leaveAction;
      setVisible(true);
    },
    [],
  );

  const handleStay = useCallback(() => {
    closePrompt();
  }, [closePrompt]);

  const handleDiscard = useCallback(() => {
    const leave = leaveActionRef.current;
    closePrompt();
    leave?.();
  }, [closePrompt]);

  const handleSave = useCallback(() => {
    if (!onSaveRef.current) {
      handleDiscard();
      return;
    }

    setSaving(true);
    void (async () => {
      try {
        const result = await onSaveRef.current?.();
        if (result === false) {
          setSaving(false);
          isPromptingRef.current = true;
          return;
        }
        const leave = leaveActionRef.current;
        closePrompt();
        leave?.();
      } catch {
        setSaving(false);
        isPromptingRef.current = true;
      }
    })();
  }, [closePrompt, handleDiscard]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      showLeavePrompt(() => navigation.dispatch(event.data.action));
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, showLeavePrompt]);

  const guardedGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const unsavedChangesDialog = (
    <UnsavedChangesModal
      visible={visible}
      title={title}
      message={message}
      showSave={Boolean(onSave)}
      saving={saving}
      onStay={handleStay}
      onSave={onSave ? handleSave : undefined}
      onDiscard={handleDiscard}
    />
  );

  return { guardedGoBack, unsavedChangesDialog };
}
