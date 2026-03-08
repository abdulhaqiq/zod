import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COUNTRIES, type Country } from '@/constants/countries';
import { useAppTheme } from '@/context/ThemeContext';

interface Props {
  visible: boolean;
  selected: Country;
  onSelect: (country: Country) => void;
  onClose: () => void;
}

export default function CountryPicker({ visible, selected, onSelect, onClose }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q) || c.iso.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = useCallback((country: Country) => {
    onSelect(country);
    setQuery('');
    onClose();
  }, [onSelect, onClose]);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  const renderItem = useCallback(({ item }: { item: Country }) => {
    const isSelected = item.iso === selected.iso;
    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Text style={styles.flag}>{item.flag}</Text>
        <Text style={[styles.countryName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.countryCode, { color: colors.textSecondary }]}>{item.code}</Text>
        {isSelected && <Ionicons name="checkmark" size={18} color={colors.text} />}
      </Pressable>
    );
  }, [selected, handleSelect, colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.modalBg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Select Country</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: colors.searchBg, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search country or code..."
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            selectionColor={colors.text}
          />
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.iso}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.borderFaint }]} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No countries found</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontFamily: 'ProductSans-Bold' },
  closeBtn: { position: 'absolute', right: 20 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, height: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular', height: '100%' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 12 },
  rowPressed: { opacity: 0.6 },
  flag: { fontSize: 24, width: 32 },
  countryName: { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },
  countryCode: { fontSize: 15, fontFamily: 'ProductSans-Regular', minWidth: 44, textAlign: 'right' },
  separator: { height: 1 },
  emptyWrap: { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontSize: 15, fontFamily: 'ProductSans-Regular' },
});
