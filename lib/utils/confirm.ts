import { Alert, Platform } from 'react-native';

/** Confirm dialog that works on web (Alert.alert buttons are unreliable there). */
export function confirmAction(input: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmLabel = 'OK' } = input;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: input.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

export function presentActions(input: {
  title: string;
  message?: string;
  actions: { label: string; destructive?: boolean; onPress: () => void }[];
}): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const lines = input.actions.map((a, i) => `${i + 1}. ${a.label}`).join('\n');
    const pick = window.prompt(
      `${input.title}${input.message ? `\n${input.message}` : ''}\n\n${lines}\n\nType 1 for Edit, 2 for Delete…`,
    );
    const index = Number(pick) - 1;
    if (Number.isFinite(index) && input.actions[index]) {
      input.actions[index].onPress();
    }
    return;
  }

  Alert.alert(input.title, input.message, [
    ...input.actions.map((a) => ({
      text: a.label,
      style: (a.destructive ? 'destructive' : 'default') as 'destructive' | 'default',
      onPress: a.onPress,
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
