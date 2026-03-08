import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

const MAX_SELECT = 5;

const ALL_INTERESTS = [
  { id: 'dogs',        emoji: '🐕', label: 'Dogs'            },
  { id: 'cats',        emoji: '🐈', label: 'Cats'            },
  { id: 'travel',      emoji: '✈️',  label: 'Travel'          },
  { id: 'food',        emoji: '🍕', label: 'Food'            },
  { id: 'cooking',     emoji: '🍳', label: 'Cooking'         },
  { id: 'coffee',      emoji: '☕', label: 'Coffee'          },
  { id: 'wine',        emoji: '🍷', label: 'Wine'            },
  { id: 'sushi',       emoji: '🍣', label: 'Sushi'           },
  { id: 'tennis',      emoji: '🎾', label: 'Tennis'          },
  { id: 'gym',         emoji: '🏋️',  label: 'Gym'             },
  { id: 'yoga',        emoji: '🧘', label: 'Yoga'            },
  { id: 'running',     emoji: '🏃', label: 'Running'         },
  { id: 'cycling',     emoji: '🚴', label: 'Cycling'         },
  { id: 'swimming',    emoji: '🏊', label: 'Swimming'        },
  { id: 'hiking',      emoji: '🥾', label: 'Hiking'          },
  { id: 'skiing',      emoji: '⛷️',  label: 'Skiing'          },
  { id: 'surfing',     emoji: '🏄', label: 'Surfing'         },
  { id: 'camping',     emoji: '🏕️',  label: 'Camping'         },
  { id: 'crafts',      emoji: '🎨', label: 'Crafts'          },
  { id: 'art',         emoji: '🖼️',  label: 'Art'             },
  { id: 'photography', emoji: '📸', label: 'Photography'     },
  { id: 'music',       emoji: '🎵', label: 'Music'           },
  { id: 'guitar',      emoji: '🎸', label: 'Guitar'          },
  { id: 'piano',       emoji: '🎹', label: 'Piano'           },
  { id: 'movies',      emoji: '🎬', label: 'Movies'          },
  { id: 'theatre',     emoji: '🎭', label: 'Theatre'         },
  { id: 'reading',     emoji: '📚', label: 'Reading'         },
  { id: 'gaming',      emoji: '🎮', label: 'Gaming'          },
  { id: 'boardgames',  emoji: '🎲', label: 'Board games'     },
  { id: 'karaoke',     emoji: '🎤', label: 'Karaoke'         },
  { id: 'dancing',     emoji: '💃', label: 'Dancing'         },
  { id: 'soccer',      emoji: '⚽', label: 'Soccer'          },
  { id: 'basketball',  emoji: '🏀', label: 'Basketball'      },
  { id: 'football',    emoji: '🏈', label: 'Football'        },
  { id: 'plants',      emoji: '🌿', label: 'Plants'          },
  { id: 'beach',       emoji: '🌊', label: 'Beach'           },
  { id: 'astrology',   emoji: '🌙', label: 'Astrology'       },
  { id: 'meditation',  emoji: '🧠', label: 'Meditation'      },
  { id: 'volunteering',emoji: '🤝', label: 'Volunteering'    },
  { id: 'fashion',     emoji: '👗', label: 'Fashion'         },
  { id: 'startups',    emoji: '🚀', label: 'Startups'        },
  { id: 'tech',        emoji: '💻', label: 'Tech'            },
  { id: 'podcasts',    emoji: '🎙️',  label: 'Podcasts'        },
  { id: 'wine_bars',   emoji: '🥂', label: 'Wine bars'       },
  { id: 'tacos',       emoji: '🌮', label: 'Tacos'           },
];

export default function Interests() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [touched,  setTouched]  = useState(false);

  const filtered = useMemo(() =>
    ALL_INTERESTS.filter(i =>
      i.label.toLowerCase().includes(query.toLowerCase())
    ),
    [query]
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT) {
        next.add(id);
      }
      return next;
    });
  };

  const error = touched && selected.size < MAX_SELECT
    ? `Pick ${MAX_SELECT - selected.size} more interest${MAX_SELECT - selected.size > 1 ? 's' : ''}`
    : null;

  const handleContinue = () => {
    setTouched(true);
    if (selected.size < MAX_SELECT) return;
    router.push('/lifestyle');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Squircle>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Pick {MAX_SELECT} things{'\n'}you love</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          These show up on your profile to spark conversations.
        </Text>

        {/* Search bar */}
        <Squircle
          style={[styles.searchWrap, { borderColor: colors.inputBorder }]}
          cornerRadius={16}
          cornerSmoothing={1}
          fillColor={colors.inputBg}
          strokeColor={colors.inputBorder}
          strokeWidth={1.5}
        >
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search interests…"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </Squircle>

        {/* Counter */}
        <View style={styles.counterRow}>
          <Text style={[styles.counter, { color: selected.size === MAX_SELECT ? colors.btnPrimaryBg : colors.textSecondary }]}>
            {selected.size} / {MAX_SELECT} selected
          </Text>
          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={12} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.gridWrap} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {filtered.map((item) => {
            const isSelected = selected.has(item.id);
            const atMax = selected.size >= MAX_SELECT && !isSelected;

            return (
              <Pressable
                key={item.id}
                onPress={() => !atMax && toggle(item.id)}
                style={({ pressed }) => [pressed && !atMax && { opacity: 0.8 }]}
              >
                <Squircle
                  style={[styles.chip, atMax && { opacity: 0.35 }]}
                  cornerRadius={24}
                  cornerSmoothing={0.8}
                  fillColor={isSelected ? colors.btnPrimaryBg : colors.surface}
                  strokeColor={isSelected ? colors.btnPrimaryBg : colors.border}
                  strokeWidth={isSelected ? 0 : 1.5}
                >
                  <Text style={styles.chipEmoji}>{item.emoji}</Text>
                  <Text style={[styles.chipLabel, { color: isSelected ? colors.btnPrimaryText : colors.text }]}>
                    {item.label}
                  </Text>
                </Squircle>
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No matches for "{query}"</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Continue" onPress={handleContinue} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  topBar:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  header:      { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  title:       { fontSize: 34, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 8 },
  subtitle:    { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 16 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'ProductSans-Regular' },
  counterRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  counter:     { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  errorRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorText:   { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  gridWrap:    { paddingHorizontal: 20, paddingBottom: 16 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  chipEmoji:   { fontSize: 16 },
  chipLabel:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  emptyText:   { fontSize: 14, fontFamily: 'ProductSans-Regular', marginTop: 16 },
  footer:      { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn:         { width: '100%' },
});
