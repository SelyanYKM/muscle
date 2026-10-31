import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
}

/** Coquille commune à toutes les "feuilles basses" du handoff v2 (remplace Alert.alert et les modals centrées). */
export const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, children, maxHeightPercent = 84 }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      {/* Fond cliquable pour refermer : masqué au lecteur d'écran (chaque feuille a son propre
          bouton Fermer / Annuler), sinon TalkBack s'arrête sur un grand bouton sans nom. */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
        accessible={false}
        importantForAccessibility="no"
      />
      <View
        style={[styles.sheet, { maxHeight: `${maxHeightPercent}%` as const }]}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        {children}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: THEME.colors.backdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.colors.cardBg,
    borderTopLeftRadius: THEME.radius.sheet,
    borderTopRightRadius: THEME.radius.sheet,
    padding: 20,
    paddingBottom: 28,
  },
});
