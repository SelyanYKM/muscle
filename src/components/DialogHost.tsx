import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';
import { DialogButton, DialogRequest, registerDialogHost } from '../utils/dialog';
import { BottomSheet } from './BottomSheet';

// Le temps que la feuille se referme avant d'exécuter l'action : une action qui ouvre une autre
// feuille, un sélecteur de fichier ou une nouvelle boîte de dialogue ne s'empile pas sur la
// feuille en train de partir.
const CLOSE_DELAY_MS = 260;

/**
 * Hôte unique des boîtes de dialogue (voir utils/dialog.ts), monté à la racine de l'app.
 * Les demandes arrivées pendant qu'une feuille est ouverte attendent leur tour.
 */
export const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const pendingAction = useRef<(() => void) | undefined>(undefined);

  useEffect(() => registerDialogHost((request) => setQueue((q) => [...q, request])), []);

  const current = isClosing ? null : queue[0] ?? null;

  const close = (action?: () => void) => {
    pendingAction.current = action;
    setIsClosing(true);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setIsClosing(false);
      const run = pendingAction.current;
      pendingAction.current = undefined;
      run?.();
    }, CLOSE_DELAY_MS);
  };

  // Ordre de la feuille : actions d'abord (la première en plein), « Annuler » en dernier.
  const request = queue[0];
  const cancel = request?.buttons.find((b) => b.style === 'cancel');
  const actions = request?.buttons.filter((b) => b !== cancel) ?? [];

  const renderButton = (b: DialogButton, index: number) => {
    const isDestructive = b.style === 'destructive';
    const isPrimary = index === 0 && !isDestructive;
    return (
      <TouchableOpacity
        key={`${b.text}-${index}`}
        style={[styles.btn, isDestructive ? styles.destructiveBtn : isPrimary ? styles.primaryBtn : styles.outlineBtn]}
        onPress={() => close(b.onPress)}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={isDestructive ? styles.destructiveBtnText : isPrimary ? styles.primaryBtnText : styles.outlineBtnText}>{b.text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet visible={!!current} onClose={() => close(cancel?.onPress)} maxHeightPercent={70}>
      {request && (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {request.title}
          </Text>
          {!!request.message && <Text style={styles.message}>{request.message}</Text>}
          <View style={[styles.buttons, !request.message && styles.buttonsNoMessage]}>
            {actions.map(renderButton)}
            {cancel && (
              <TouchableOpacity
                style={[styles.btn, styles.outlineBtn]}
                onPress={() => close(cancel.onPress)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.outlineBtnText}>{cancel.text}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    color: THEME.colors.textPrimary,
  },
  message: {
    fontFamily: THEME.fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME.colors.textSecondary,
    marginTop: 8,
  },
  buttons: {
    marginTop: 20,
    gap: 8,
  },
  buttonsNoMessage: {
    marginTop: 16,
  },
  btn: {
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: THEME.colors.textPrimary,
  },
  primaryBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 14,
    color: '#FFFFFF',
  },
  destructiveBtn: {
    backgroundColor: THEME.colors.feelingHardBg,
  },
  destructiveBtnText: {
    fontFamily: THEME.fonts.sansHeavy,
    fontSize: 14,
    color: THEME.colors.feelingHardText,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  outlineBtnText: {
    fontFamily: THEME.fonts.sans,
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
});
