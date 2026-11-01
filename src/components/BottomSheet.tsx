import React from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { THEME } from '../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
  /**
   * Soulève la feuille de la hauteur du clavier quand un champ est actif (formulaires courts dont
   * le bouton de validation est en bas : "Nouvel exercice", "Ajouter une pesée"). À laisser
   * désactivé pour les feuilles hautes dont les champs sont en haut (éditeur de l'Historique) :
   * soulevées, leur haut sortirait de l'écran.
   */
  avoidKeyboard?: boolean;
}

/** Coquille commune à toutes les "feuilles basses" du handoff v2 (remplace Alert.alert et les modals centrées). */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  maxHeightPercent = 84,
  avoidKeyboard = false,
}) => {
  // Hauteur max calculée sur l'écran entier (et pas en % du conteneur) : quand le clavier
  // réduit l'espace, la feuille garde sa taille et se décale vers le haut au lieu d'être coupée.
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* "padding" sur Android aussi : dans une Modal en plein écran (edge-to-edge), la fenêtre
          n'est pas redimensionnée par le clavier, qui recouvrait le bas de la feuille. */}
      <KeyboardAvoidingView style={styles.flex} behavior={avoidKeyboard ? 'padding' : undefined} enabled={avoidKeyboard}>
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
            style={[styles.sheet, { maxHeight: (windowHeight * maxHeightPercent) / 100 }]}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
          >
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
