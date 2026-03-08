import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SliderRN from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Defs, LinearGradient as SvgGrad, Path, Rect, Stop, Svg } from 'react-native-svg';
import Squircle from '@/components/ui/Squircle';
import MyProfilePage from '@/components/MyProfilePage';
import { useAppTheme } from '@/context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W          = W - 32;
const CARD_H          = H * 0.68;
const PHOTO_H         = CARD_H;
const SWIPE_THRESHOLD = W * 0.27;

// ─── Logo ─────────────────────────────────────────────────────────────────────

const AppLogo = ({ color }: { color: string }) => (
  <Svg width={52} height={24} viewBox="0 0 741 347" fill="none">
    <Path d="M168.701 346.924H0L128.174 116.699C84.9609 127.441 35.6445 169.922 21.4844 201.416C6.34766 186.768 0 170.898 0 156.494C0 130.615 20.9961 109.619 49.5605 109.619H218.262L91.0645 339.6C134.033 328.613 182.617 286.377 196.777 255.127C211.914 269.775 218.262 285.4 218.262 299.805C218.262 325.928 197.266 346.924 168.701 346.924ZM347.9 346.924C282.471 346.924 229.492 293.701 229.492 228.027C229.492 162.354 282.471 109.131 347.9 109.131C413.33 109.131 466.309 162.354 466.309 228.027C466.309 293.701 413.33 346.924 347.9 346.924ZM393.799 320.068C402.344 320.068 407.471 312.988 407.471 301.025C407.471 253.662 336.182 136.23 302.002 135.986C293.945 135.986 288.33 142.578 288.33 155.029C288.33 202.393 359.619 320.068 393.799 320.068ZM707.275 346.924C675.781 346.924 644.775 335.693 644.775 300.781C631.592 330.566 602.539 346.924 573.73 346.924C545.166 346.924 516.846 331.055 503.662 297.119C497.314 280.518 494.141 259.521 494.141 237.793C494.141 209.229 499.512 179.932 509.521 158.936C525.635 124.756 556.396 108.887 584.473 108.887C612.061 108.887 637.207 124.023 644.775 151.855V80.8105C644.775 58.1055 640.869 51.5137 623.535 41.2598L724.854 0V312.012C724.854 324.951 729.248 339.355 740.723 342.773C730.957 345.459 718.994 346.924 707.275 346.924ZM615.479 307.129C625.244 307.129 635.742 301.514 644.775 291.26V161.133C636.475 148.926 627.93 143.555 619.873 143.555C596.436 143.555 582.764 186.768 582.764 237.305C582.764 250.732 583.74 263.916 586.182 275.391C590.82 297.119 602.539 307.129 615.479 307.129Z" fill={color} />
  </Svg>
);

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: 'people',  icon: 'people-outline'      as const, iconActive: 'people'      as const },
  { id: 'likeyou', icon: 'heart-outline'       as const, iconActive: 'heart'       as const, badge: '7' },
  { id: 'ai',      icon: 'sparkles-outline'    as const, iconActive: 'sparkles'    as const },
  { id: 'chats',   icon: 'chatbubbles-outline' as const, iconActive: 'chatbubbles' as const, badge: '4' },
  { id: 'profile', icon: 'person-outline'      as const, iconActive: 'person'      as const },
];

const MY_AVATAR = 'https://randomuser.me/api/portraits/men/32.jpg';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string; name: string; age: number; verified: boolean; premium: boolean;
  location: string; distance: string; about: string;
  images: string[];
  details: { height: string; drinks: string; smokes: string; gender: string; wantsKids: string; sign: string; politics: string; religion: string; work: string; education: string };
  lookingFor: string;
  interests: { emoji: string; label: string }[];
  prompts: { question: string; answer: string }[];
  languages: string[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROFILES: Profile[] = [
  { id:'1', name:'Sophia',  age:25, verified:true,  premium:false, location:'Los Angeles, CA', distance:'3.5 km', about:"Hey! I'm Sophia 👋 I love long drives, spontaneous trips, and deep conversations over coffee. If you can make me laugh, we'll get along great 😄", images:['https://randomuser.me/api/portraits/women/44.jpg','https://randomuser.me/api/portraits/women/45.jpg','https://randomuser.me/api/portraits/women/46.jpg'], details:{height:"5'6\" (168 cm)",drinks:'Socially',smokes:'Never',gender:'Woman',wantsKids:'Open to it',sign:'♊ Gemini',politics:'Liberal',religion:'Spiritual',work:'UX Designer · Adobe',education:'UCLA – Design'}, lookingFor:'Something serious', interests:[{emoji:'☕',label:'Coffee'},{emoji:'✈️',label:'Travel'},{emoji:'📚',label:'Books'},{emoji:'🎨',label:'Art'},{emoji:'🍕',label:'Food'}], prompts:[{question:"Don't be mad if I…",answer:"Order dessert before checking the menu 🍰"},{question:'My ideal Sunday looks like…',answer:"Farmers market → coffee → nowhere to be 🌿"}], languages:['English','Spanish'] },
  { id:'2', name:'Elena',   age:22, verified:true,  premium:true,  location:'New York, NY',    distance:'1.2 km', about:"Artist by day, dreamer by night 🎨 I find magic in small things — a good book, a rainy afternoon, and the perfect playlist.", images:['https://randomuser.me/api/portraits/women/68.jpg','https://randomuser.me/api/portraits/women/69.jpg'], details:{height:"5'4\" (163 cm)",drinks:'Never',smokes:'Never',gender:'Woman',wantsKids:'Yes, I do',sign:'♓ Pisces',politics:'Progressive',religion:'Agnostic',work:'Fine Art Painter',education:'NYU – Fine Arts'}, lookingFor:'My forever person', interests:[{emoji:'🎨',label:'Art'},{emoji:'🎵',label:'Music'},{emoji:'🧘',label:'Yoga'},{emoji:'📸',label:'Photography'},{emoji:'🍷',label:'Wine'}], prompts:[{question:'The way to win me over is…',answer:"Show up with coffee and zero agenda ☕"},{question:'My most controversial opinion…',answer:"Pineapple on pizza is fine. Fight me 🍍"}], languages:['English','French'] },
  { id:'3', name:'Maya',    age:27, verified:false, premium:false, location:'Miami, FL',        distance:'5.8 km', about:"Beach lover, fitness freak, and foodie 🌊 Living my best life in Miami. Let's explore this city together!", images:['https://randomuser.me/api/portraits/women/50.jpg','https://randomuser.me/api/portraits/women/51.jpg'], details:{height:"5'7\" (170 cm)",drinks:'Socially',smokes:'Never',gender:'Woman',wantsKids:'No',sign:'♌ Leo',politics:'Moderate',religion:'Christian',work:'Personal Trainer',education:'FIU – Sports Science'}, lookingFor:'Casual dating', interests:[{emoji:'🏖️',label:'Beach'},{emoji:'🏋️',label:'Gym'},{emoji:'🍜',label:'Food'},{emoji:'🏄',label:'Surfing'},{emoji:'📸',label:'Photography'}], prompts:[{question:"Don't be mad if I…",answer:"Drag you to the gym at 6am and love it 💪"}], languages:['English','Portuguese'] },
  { id:'4', name:'Aria',    age:24, verified:true,  premium:false, location:'Austin, TX',       distance:'2.1 km', about:"Engineer who codes by day and dances by night 💃 Looking for someone who can keep up.", images:['https://randomuser.me/api/portraits/women/79.jpg','https://randomuser.me/api/portraits/women/80.jpg'], details:{height:"5'5\" (165 cm)",drinks:'Regularly',smokes:'Never',gender:'Woman',wantsKids:'Open to it',sign:'♈ Aries',politics:'Liberal',religion:'Atheist',work:'Software Engineer · Apple',education:'UT Austin – CS'}, lookingFor:'Something serious', interests:[{emoji:'💃',label:'Dancing'},{emoji:'👗',label:'Fashion'},{emoji:'💻',label:'Tech'},{emoji:'🎮',label:'Gaming'},{emoji:'🌮',label:'Tacos'}], prompts:[{question:'Two truths and a lie…',answer:"I've met Elon. I speak 3 languages. I hate tacos 👀"}], languages:['English','Korean'] },
  { id:'5', name:'Zara',    age:26, verified:true,  premium:true,  location:'Chicago, IL',      distance:'4.0 km', about:"Adventure seeker with a glass of red 🍷 Happiest on a mountain trail or rooftop bar. Let's do both.", images:['https://randomuser.me/api/portraits/women/32.jpg','https://randomuser.me/api/portraits/women/33.jpg','https://randomuser.me/api/portraits/women/34.jpg'], details:{height:"5'8\" (173 cm)",drinks:'Regularly',smokes:'Socially',gender:'Woman',wantsKids:'No',sign:'♏ Scorpio',politics:'Moderate',religion:'Buddhist',work:'Travel Photographer',education:'Northwestern – Journalism'}, lookingFor:'Casual dating', interests:[{emoji:'🥾',label:'Hiking'},{emoji:'📸',label:'Photography'},{emoji:'🍷',label:'Wine'},{emoji:'🏕️',label:'Camping'},{emoji:'⛷️',label:'Skiing'}], prompts:[{question:'I know the best spot for…',answer:"Rooftop sunsets + cheap cocktails 🌅"},{question:'Catch flights or feelings?',answer:"Both. At the same time. Efficiency 🛫❤️"}], languages:['English','Swahili'] },
];

const LIKED_PROFILES: Profile[] = [
  { id:'l1', name:'Mia',    age:24, verified:true,  premium:false, location:'San Francisco, CA', distance:'2.1 km', about:"Coffee addict & bookworm ☕📚", images:['https://randomuser.me/api/portraits/women/22.jpg'], details:{height:"5'4\"",drinks:'Socially',smokes:'Never',gender:'Woman',wantsKids:'Open to it',sign:'♉ Taurus',politics:'Liberal',religion:'Agnostic',work:'Product Manager',education:'Stanford – Business'}, lookingFor:'Something serious', interests:[{emoji:'☕',label:'Coffee'},{emoji:'📚',label:'Books'}], prompts:[], languages:['English'] },
  { id:'l2', name:'Jade',   age:26, verified:false, premium:false, location:'Oakland, CA',        distance:'4.3 km', about:"Hiking & tech person 🏔️", images:['https://randomuser.me/api/portraits/women/55.jpg'], details:{height:"5'6\"",drinks:'Never',smokes:'Never',gender:'Woman',wantsKids:'No',sign:'♊ Gemini',politics:'Progressive',religion:'Atheist',work:'Software Engineer',education:'UC Berkeley – CS'}, lookingFor:'Casual dating', interests:[{emoji:'🥾',label:'Hiking'},{emoji:'💻',label:'Tech'}], prompts:[], languages:['English'] },
  { id:'l3', name:'Luna',   age:23, verified:true,  premium:true,  location:'LA, CA',             distance:'1.0 km', about:"Art & soul 🎨✨", images:['https://randomuser.me/api/portraits/women/63.jpg'], details:{height:"5'3\"",drinks:'Socially',smokes:'Never',gender:'Woman',wantsKids:'Yes',sign:'♓ Pisces',politics:'Moderate',religion:'Spiritual',work:'Illustrator',education:'CalArts'}, lookingFor:'My forever person', interests:[{emoji:'🎨',label:'Art'},{emoji:'🌙',label:'Moonwalks'}], prompts:[], languages:['English','Spanish'] },
  { id:'l4', name:'River',  age:28, verified:true,  premium:false, location:'Portland, OR',       distance:'8.2 km', about:"Forest + films person 🌲🎬", images:['https://randomuser.me/api/portraits/women/77.jpg'], details:{height:"5'7\"",drinks:'Regularly',smokes:'Socially',gender:'Non-binary',wantsKids:'No',sign:'♍ Virgo',politics:'Liberal',religion:'Pagan',work:'Filmmaker',education:'Portland State'}, lookingFor:'Casual dating', interests:[{emoji:'🎬',label:'Film'},{emoji:'🌲',label:'Nature'}], prompts:[], languages:['English'] },
  { id:'l5', name:'Chloe',  age:25, verified:false, premium:false, location:'Denver, CO',         distance:'6.0 km', about:"Mountains are my therapy 🏔️", images:['https://randomuser.me/api/portraits/women/88.jpg'], details:{height:"5'5\"",drinks:'Socially',smokes:'Never',gender:'Woman',wantsKids:'Open to it',sign:'♑ Capricorn',politics:'Moderate',religion:'Christian',work:'Nurse',education:'University of Colorado'}, lookingFor:'Something serious', interests:[{emoji:'🏔️',label:'Mountains'},{emoji:'🩺',label:'Health'}], prompts:[], languages:['English'] },
  { id:'l6', name:'Nadia',  age:29, verified:true,  premium:true,  location:'Seattle, WA',        distance:'3.7 km', about:"Rain & ramen lover 🌧️🍜", images:['https://randomuser.me/api/portraits/women/35.jpg'], details:{height:"5'6\"",drinks:'Regularly',smokes:'Never',gender:'Woman',wantsKids:'No',sign:'♎ Libra',politics:'Progressive',religion:'Buddhist',work:'Data Scientist',education:'UW – Statistics'}, lookingFor:'Casual dating', interests:[{emoji:'🍜',label:'Ramen'},{emoji:'📊',label:'Data'}], prompts:[], languages:['English','Russian'] },
];

// ─── Profile Card (scrollable + swipeable) ────────────────────────────────────

function ProfileCard({ profile, onSwipedLeft, onSwipedRight, colors }: {
  profile: Profile;
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  colors: any;
}) {
  const position = useRef(new Animated.ValueXY()).current;

  const onSwipedLeftRef  = useRef(onSwipedLeft);
  const onSwipedRightRef = useRef(onSwipedRight);
  useEffect(() => { onSwipedLeftRef.current = onSwipedLeft; onSwipedRightRef.current = onSwipedRight; }, [onSwipedLeft, onSwipedRight]);

  const resetCard = () => {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6, tension: 40 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Intercept in capture phase when clearly horizontal — beats ScrollView
      onMoveShouldSetPanResponderCapture: (_, g) => {
        const ax = Math.abs(g.dx);
        const ay = Math.abs(g.dy);
        return ax > ay && ax > 6;
      },
      onMoveShouldSetPanResponder: (_, g) => {
        const ax = Math.abs(g.dx);
        const ay = Math.abs(g.dy);
        return ax > ay && ax > 6;
      },
      onPanResponderGrant: () => {
        position.setOffset({ x: (position.x as any)._value, y: 0 });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        position.flattenOffset();
        if (g.dx > SWIPE_THRESHOLD || g.vx > 0.8) {
          Animated.timing(position, { toValue: { x: W + 200, y: g.dy }, duration: 220, useNativeDriver: true })
            .start(() => onSwipedRightRef.current());
        } else if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.8) {
          Animated.timing(position, { toValue: { x: -(W + 200), y: g.dy }, duration: 220, useNativeDriver: true })
            .start(() => onSwipedLeftRef.current());
        } else {
          resetCard();
        }
      },
      onPanResponderTerminate: () => {
        position.flattenOffset();
        resetCard();
      },
    })
  ).current;

  const rotate    = position.x.interpolate({ inputRange: [-W * 0.6, 0, W * 0.6], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' });
  const cardStyle = { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] };

  const DETAILS = [
    { icon: 'resize-outline'      as const, label: 'Height',     value: profile.details.height    },
    { icon: 'wine-outline'        as const, label: 'Drinks',     value: profile.details.drinks    },
    { icon: 'flame-outline'       as const, label: 'Smokes',     value: profile.details.smokes    },
    { icon: 'transgender-outline' as const, label: 'Gender',     value: profile.details.gender    },
    { icon: 'people-outline'      as const, label: 'Wants kids', value: profile.details.wantsKids },
    { icon: 'star-outline'        as const, label: 'Star sign',  value: profile.details.sign      },
    { icon: 'flag-outline'        as const, label: 'Politics',   value: profile.details.politics  },
    { icon: 'globe-outline'       as const, label: 'Religion',   value: profile.details.religion  },
  ];

  const likeOpacityAnim = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacityAnim = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View style={[styles.card, cardStyle]} {...panResponder.panHandlers}>
      <Animated.View style={[styles.likeStamp, { opacity: likeOpacityAnim }]} pointerEvents="none">
        <Text style={styles.likeStampText}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacityAnim }]} pointerEvents="none">
        <Text style={styles.nopeStampText}>NOPE</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        directionalLockEnabled
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Photo */}
        <View style={styles.photoContainer}>
          <Image source={{ uri: profile.images[0] }} style={styles.photo} resizeMode="cover" />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width={CARD_W} height={CARD_H}>
          <Defs>
                <SvgGrad id={`gp${profile.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.5"  stopColor="#000" stopOpacity="0"    />
                  <Stop offset="0.82" stopColor="#000" stopOpacity="0.7"  />
                  <Stop offset="1"    stopColor="#000" stopOpacity="0.95" />
            </SvgGrad>
          </Defs>
              <Rect width={CARD_W} height={CARD_H} fill={`url(#gp${profile.id})`} />
        </Svg>
      </View>
          <View style={styles.photoInfo} pointerEvents="none">
        {profile.premium && (
          <View style={styles.premiumBadge}>
                <Ionicons name="star" size={10} color="#FFD60A" />
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        )}
        <View style={styles.nameRow}>
              <Text style={styles.photoName}>{profile.name}, {profile.age}</Text>
              {profile.verified && <Ionicons name="checkmark-circle" size={20} color="#4FC3F7" style={{ marginLeft: 6 }} />}
        </View>
        <View style={styles.locationRow}>
              <Ionicons name="location" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.locationText}>{profile.location} · {profile.distance}</Text>
            </View>
            <View style={styles.scrollHint}>
              <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.6)" />
              <Text style={styles.scrollHintText}>Scroll to see more</Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.detailsSection, { backgroundColor: colors.surface }]}>
          <View style={styles.sec}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>ABOUT</Text>
            <Text style={[styles.aboutText, { color: colors.text }]}>{profile.about}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.sec}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LOCATION</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={15} color={colors.btnPrimaryBg} />
              <Text style={[styles.locationCardCity, { color: colors.text }]}>{profile.location}</Text>
              <Text style={[styles.locationCardDist, { color: colors.textSecondary }]}>· {profile.distance} away</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {profile.prompts[0] && <>
            <View style={[styles.promptCard, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.promptQ, { color: colors.textSecondary }]}>{profile.prompts[0].question}</Text>
              <Text style={[styles.promptA, { color: colors.text }]}>{profile.prompts[0].answer}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          {profile.images[1] && <>
            <Image source={{ uri: profile.images[1] }} style={styles.inlinePhoto} resizeMode="cover" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          <View style={styles.sec}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LOOKING FOR</Text>
            <View style={[styles.lookingRow, { backgroundColor: colors.surface2 }]}>
              <Ionicons name="heart" size={16} color={colors.btnPrimaryBg} />
              <Text style={[styles.lookingText, { color: colors.text }]}>{profile.lookingFor}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.sec}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>INTERESTS</Text>
            <View style={styles.chipRow}>
              {profile.interests.map(item => (
                <View key={item.label} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                  <Text style={styles.chipEmoji}>{item.emoji}</Text>
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {profile.prompts[1] && <>
            <View style={[styles.promptCard, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.promptQ, { color: colors.textSecondary }]}>{profile.prompts[1].question}</Text>
              <Text style={[styles.promptA, { color: colors.text }]}>{profile.prompts[1].answer}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          {profile.images[2] && <>
            <Image source={{ uri: profile.images[2] }} style={styles.inlinePhoto} resizeMode="cover" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>}

          <View style={styles.sec}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>WORK & STUDIES</Text>
            <View style={styles.workRow}>
              <View style={[styles.workCard, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="briefcase-outline" size={18} color={colors.text} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.workLabel, { color: colors.textSecondary }]}>Works at</Text>
                  <Text style={[styles.workValue, { color: colors.text }]} numberOfLines={2}>{profile.details.work}</Text>
                </View>
              </View>
              <View style={[styles.workCard, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="school-outline" size={18} color={colors.text} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.workLabel, { color: colors.textSecondary }]}>Studied at</Text>
                  <Text style={[styles.workValue, { color: colors.text }]} numberOfLines={2}>{profile.details.education}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.sec}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>DETAILS</Text>
            <View style={styles.detailGrid}>
              {DETAILS.map(d => (
                <View key={d.label} style={[styles.detailChip, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name={d.icon} size={13} color={colors.btnPrimaryBg} />
                  <View>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{d.label}</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{d.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.sec}>
            <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LANGUAGES</Text>
            <View style={styles.chipRow}>
              {profile.languages.map(lang => (
                <View key={lang} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name="language-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{lang}</Text>
            </View>
          ))}
        </View>
      </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.dangerRow}>
            <Pressable style={({ pressed }) => [styles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="flag-outline" size={15} color={colors.error} />
              <Text style={[styles.dangerBtnText, { color: colors.error }]}>Report</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.dangerBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }, pressed && { opacity: 0.65 }]}>
              <Ionicons name="ban-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.dangerBtnText, { color: colors.textSecondary }]}>Block</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onReset, colors }: { onReset: () => void; colors: any }) {
  return (
    <View style={styles.emptyWrap}>
      <Squircle style={styles.emptyIcon} cornerRadius={32} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name="heart-circle-outline" size={44} color={colors.textTertiary} />
      </Squircle>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>You've seen everyone!</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Check back soon for more people nearby</Text>
      <Pressable onPress={onReset} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <Squircle style={styles.resetBtn} cornerRadius={20} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1.5}>
          <Ionicons name="refresh" size={18} color={colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.resetBtnText, { color: colors.text }]}>Start over</Text>
        </Squircle>
      </Pressable>
    </View>
  );
}

// ─── Range Slider ─────────────────────────────────────────────────────────────

function RangeSlider({
  min, max, low, high, step = 1, colors,
  onLowChange, onHighChange,
}: {
  min: number; max: number; low: number; high: number; step?: number; colors: any;
  onLowChange: (v: number) => void; onHighChange: (v: number) => void;
}) {
  const THUMB = 26;
  const TRACK_H = 4;
  const MIN_GAP = THUMB * 0.9;

  // Plain refs — no private Animated internals
  const trackWRef    = useRef(0);
  const lowPxRef     = useRef(0);
  const highPxRef    = useRef(0);
  const startLowRef  = useRef(0);
  const startHighRef = useRef(0);

  const lowAnim  = useRef(new Animated.Value(0)).current;
  const highAnim = useRef(new Animated.Value(0)).current;
  const fillLeft = useRef(Animated.add(lowAnim,  new Animated.Value(THUMB / 2))).current;
  const fillWidth= useRef(Animated.subtract(highAnim, lowAnim)).current;

  const valToPx = (val: number, tw: number) =>
    ((val - min) / (max - min)) * tw;

  const pxToVal = (px: number, tw: number) => {
    const pct = Math.max(0, Math.min(1, px / tw));
    return Math.round((pct * (max - min)) / step) * step + min;
  };

  const initPositions = (tw: number) => {
    const lx = valToPx(low,  tw);
    const hx = valToPx(high, tw);
    lowPxRef.current  = lx;
    highPxRef.current = hx;
    lowAnim.setValue(lx);
    highAnim.setValue(hx);
  };

  const lowPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        startLowRef.current = lowPxRef.current;
      },
      onPanResponderMove: (_, g) => {
        const tw = trackWRef.current;
        const raw = startLowRef.current + g.dx;
        const clamped = Math.max(0, Math.min(raw, highPxRef.current - MIN_GAP));
        lowPxRef.current = clamped;
        lowAnim.setValue(clamped);
      },
      onPanResponderRelease: () => {
        const tw  = trackWRef.current;
        const val = pxToVal(lowPxRef.current, tw);
        const px  = valToPx(val, tw);
        lowPxRef.current = px;
        lowAnim.setValue(px);
        onLowChange(val);
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  const highPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        startHighRef.current = highPxRef.current;
      },
      onPanResponderMove: (_, g) => {
        const tw = trackWRef.current;
        const raw = startHighRef.current + g.dx;
        const clamped = Math.max(lowPxRef.current + MIN_GAP, Math.min(raw, tw));
        highPxRef.current = clamped;
        highAnim.setValue(clamped);
      },
      onPanResponderRelease: () => {
        const tw  = trackWRef.current;
        const val = pxToVal(highPxRef.current, tw);
        const px  = valToPx(val, tw);
        highPxRef.current = px;
        highAnim.setValue(px);
        onHighChange(val);
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  return (
    <View
      style={{ height: THUMB + 8, justifyContent: 'center' }}
      onLayout={e => {
        trackWRef.current = e.nativeEvent.layout.width - THUMB;
        initPositions(trackWRef.current);
      }}
    >
      {/* Track background */}
      <View style={{ height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: colors.surface2, marginHorizontal: THUMB / 2 }} />
      {/* Active fill */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: colors.text,
          left: fillLeft,
          width: fillWidth,
        }}
      />
      {/* Low thumb */}
      <Animated.View
        {...lowPan.panHandlers}
        style={{
          position: 'absolute',
          left: lowAnim,
          width: THUMB, height: THUMB, borderRadius: THUMB / 2,
          backgroundColor: colors.text,
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }}
      />
      {/* High thumb */}
      <Animated.View
        {...highPan.panHandlers}
        style={{
          position: 'absolute',
          left: highAnim,
          width: THUMB, height: THUMB, borderRadius: THUMB / 2,
          backgroundColor: colors.text,
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }}
      />
    </View>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

const LANGUAGES_LIST = ['English','Spanish','French','German','Italian','Portuguese','Japanese','Korean','Chinese','Arabic','Hindi','Russian','Swahili'];
const SIGNS_LIST     = ['♈ Aries','♉ Taurus','♊ Gemini','♋ Cancer','♌ Leo','♍ Virgo','♎ Libra','♏ Scorpio','♐ Sagittarius','♑ Capricorn','♒ Aquarius','♓ Pisces'];
const INTERESTS_LIST = [
  {emoji:'☕',label:'Coffee'},{emoji:'✈️',label:'Travel'},{emoji:'📚',label:'Books'},{emoji:'🎨',label:'Art'},
  {emoji:'🍕',label:'Food'},{emoji:'🎵',label:'Music'},{emoji:'🧘',label:'Yoga'},{emoji:'📸',label:'Photography'},
  {emoji:'🥾',label:'Hiking'},{emoji:'🎮',label:'Gaming'},{emoji:'🍷',label:'Wine'},{emoji:'🏄',label:'Surfing'},
  {emoji:'🏋️',label:'Gym'},{emoji:'💃',label:'Dancing'},{emoji:'🌿',label:'Nature'},{emoji:'🎬',label:'Film'},
  {emoji:'🐶',label:'Dogs'},{emoji:'🐱',label:'Cats'},{emoji:'🍜',label:'Cooking'},{emoji:'✍️',label:'Writing'},
];

function FilterChip({ emoji, label, selected, onPress, colors }: { emoji?: string; label: string; selected: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable onPress={onPress}>
        <Squircle
        style={styles.filterChip}
        cornerRadius={16}
          cornerSmoothing={1}
        fillColor={selected ? colors.text : colors.surface2}
        strokeColor={selected ? colors.text : colors.border}
        strokeWidth={1}
        >
        {emoji ? <Text style={{ fontSize: 13 }}>{emoji}</Text> : null}
        <Text style={[styles.filterChipText, { color: selected ? colors.bg : colors.text }]}>{label}</Text>
        </Squircle>
    </Pressable>
  );
}

function FilterSheet({ visible, onClose, colors, insets }: { visible: boolean; onClose: () => void; colors: any; insets: any }) {
  const [activeTab,    setActiveTab]    = useState<'basic' | 'pro'>('basic');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [ageMin,       setAgeMin]       = useState(18);
  const [ageMax,       setAgeMax]       = useState(45);
  const [distance,     setDistance]     = useState(50);
  const [langs,        setLangs]        = useState<string[]>([]);
  const [signs,        setSigns]        = useState<string[]>([]);
  const [interests,    setInterests]    = useState<string[]>([]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const SecHead = ({ title }: { title: string }) => (
    <Text style={[styles.filterSecHead, { color: colors.textSecondary }]}>{title}</Text>
  );

  const isDark = colors.bg === '#000000';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.sheetContainer, { backgroundColor: colors.bg }]}>

        {/* ── Gradient header ── */}
        <LinearGradient
          colors={isDark ? ['#1a1a1a','#111111','#000000'] : ['#e8e8ed','#f2f2f7','#ffffff']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[styles.sheetHeader, { paddingTop: insets.top + 10 }]}
        >
          <View style={styles.sheetHeaderRow}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetClose, pressed && { opacity: 0.6 }]}>
              <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Discover</Text>
            <Pressable onPress={() => { setVerifiedOnly(false); setAgeMin(18); setAgeMax(45); setDistance(50); setLangs([]); setSigns([]); setInterests([]); }} hitSlop={8}>
              <Text style={[styles.sheetResetText, { color: colors.textSecondary }]}>Reset</Text>
          </Pressable>
        </View>

          {/* Basic / Pro tabs */}
          <View style={[styles.filterTabRow, { backgroundColor: colors.surface2 }]}>
            <Pressable onPress={() => setActiveTab('basic')} style={{ flex: 1 }}>
              {activeTab === 'basic' ? (
                <Squircle style={styles.filterTabActive} cornerRadius={14} cornerSmoothing={1} fillColor={colors.text}>
                  <Text style={[styles.filterTabText, { color: colors.bg }]}>Basic</Text>
                </Squircle>
              ) : (
                <View style={styles.filterTabInactive}>
                  <Text style={[styles.filterTabText, { color: colors.text }]}>Basic</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => setActiveTab('pro')} style={{ flex: 1 }}>
              {activeTab === 'pro' ? (
                <Squircle style={styles.filterTabActive} cornerRadius={14} cornerSmoothing={1} fillColor={colors.text}>
                  <Ionicons name="sparkles" size={11} color={colors.bg} style={{ marginRight: 4 }} />
                  <Text style={[styles.filterTabText, { color: colors.bg }]}>Pro</Text>
                </Squircle>
              ) : (
                <View style={styles.filterTabInactive}>
                  <Ionicons name="sparkles" size={11} color={colors.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.filterTabText, { color: colors.text }]}>Pro</Text>
                </View>
              )}
            </Pressable>
          </View>
        </LinearGradient>

        {activeTab === 'basic' ? (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }} showsVerticalScrollIndicator={false}>

            {/* Age range */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.sliderLabelRow}>
                <SecHead title="AGE RANGE" />
                <Text style={[styles.sliderValue, { color: colors.text }]}>{ageMin} – {ageMax}</Text>
              </View>
              <View style={[styles.sliderEdgeRow, { marginTop: 10 }]}>
                <Text style={[styles.sliderEdge, { color: colors.textSecondary }]}>18</Text>
                <View style={{ flex: 1 }}>
                  <RangeSlider min={18} max={80} low={ageMin} high={ageMax} colors={colors} onLowChange={setAgeMin} onHighChange={setAgeMax} />
                </View>
                <Text style={[styles.sliderEdge, { color: colors.textSecondary }]}>80</Text>
              </View>
            </Squircle>

            {/* Distance */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.sliderLabelRow}>
                <SecHead title="MAX DISTANCE" />
                <Text style={[styles.sliderValue, { color: colors.text }]}>{distance === 150 ? 'Any' : `${distance} km`}</Text>
              </View>
              <View style={[styles.sliderRow, { marginTop: 10 }]}>
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>1 km</Text>
                <SliderRN style={{ flex: 1 }} minimumValue={1} maximumValue={150} step={1} value={distance} onValueChange={v => setDistance(Math.round(v))} minimumTrackTintColor={colors.text} maximumTrackTintColor={colors.surface2} thumbTintColor={colors.text} />
                <Text style={[styles.sliderSub, { color: colors.textSecondary }]}>Any</Text>
              </View>
            </Squircle>

            {/* Verified only */}
            <Squircle style={[styles.filterCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <Squircle style={styles.filterRowIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
              </Squircle>
              <View style={{ flex: 1 }}>
                <Text style={[styles.filterRowTitle, { color: colors.text }]}>Verified only</Text>
                <Text style={[styles.filterRowSub, { color: colors.textSecondary }]}>Show only verified profiles</Text>
              </View>
              <Switch value={verifiedOnly} onValueChange={setVerifiedOnly} thumbColor={colors.bg} trackColor={{ false: colors.surface2, true: colors.text }} />
            </Squircle>

            {/* Interests */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="INTERESTS" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {INTERESTS_LIST.map(v => (
                  <FilterChip key={v.label} emoji={v.emoji} label={v.label} selected={interests.includes(v.label)} onPress={() => toggle(interests, setInterests, v.label)} colors={colors} />
                ))}
              </View>
            </Squircle>

            {/* Star sign */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="STAR SIGN" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {SIGNS_LIST.map(v => <FilterChip key={v} label={v} selected={signs.includes(v)} onPress={() => toggle(signs, setSigns, v)} colors={colors} />)}
              </View>
            </Squircle>

            {/* Languages */}
            <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <SecHead title="LANGUAGE" />
              <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                {LANGUAGES_LIST.map(v => <FilterChip key={v} label={v} selected={langs.includes(v)} onPress={() => toggle(langs, setLangs, v)} colors={colors} />)}
              </View>
            </Squircle>

          </ScrollView>
        ) : (
          /* Pro tab — blurred feature list */
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120, gap: 14 }}
            showsVerticalScrollIndicator={false}
          >
            {/* What you unlock — header */}
            <Squircle style={styles.proHeaderCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={styles.proHeaderRow}>
                <Squircle style={styles.proHeaderIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="sparkles" size={20} color={colors.text} />
                </Squircle>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.proHeaderTitle, { color: colors.text }]}>Pro Filters</Text>
                  <Text style={[styles.proHeaderSub, { color: colors.textSecondary }]}>10 advanced filters + AI features</Text>
                </View>
                <Squircle style={styles.proLockBadge} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
                  <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
                </Squircle>
              </View>
            </Squircle>

            {/* ADVANCED FILTERS label */}
            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2 }]}>ADVANCED FILTERS</Text>

            {/* Looking for — dimmed */}
            <View>
              <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <SecHead title="LOOKING FOR" />
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                  {['Something serious','My forever person','Casual dating','Something physical','Marriage','Open to anything'].map(v => (
                    <Squircle key={v} style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                      <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>{v}</Text>
                    </Squircle>
                  ))}
                </View>
              </Squircle>
            </View>

            {/* Height — dimmed */}
            <View>
              <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <SecHead title="HEIGHT RANGE" />
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.sliderEdgeRow, { marginTop: 10 }]}>
                  <Text style={[styles.sliderEdge, { color: colors.textSecondary }]}>4'8"</Text>
                  <View style={[styles.proFakeFill, { flex: 1, marginHorizontal: 8 }]}>
                    <View style={[styles.proFakeTrack, { backgroundColor: colors.surface2 }]} />
                    <View style={[styles.proFakeActive, { backgroundColor: colors.textSecondary, left: '15%', right: '20%' }]} />
                    <View style={[styles.proFakeThumb, { backgroundColor: colors.textSecondary, left: '13%' }]} />
                    <View style={[styles.proFakeThumb, { backgroundColor: colors.textSecondary, right: '18%' }]} />
                  </View>
                  <Text style={[styles.sliderEdge, { color: colors.textSecondary }]}>6'6"</Text>
                </View>
              </Squircle>
            </View>

            {/* Education — dimmed */}
            <View>
              <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <SecHead title="EDUCATION LEVEL" />
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                  {["High school","Bachelor's","Master's","PhD","Trade school"].map(v => (
                    <Squircle key={v} style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                      <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>{v}</Text>
                    </Squircle>
                  ))}
                </View>
              </Squircle>
            </View>

            {/* Kids & Drinks & Smokes row — dimmed */}
            <View style={{ gap: 14 }}>
              <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <SecHead title="KIDS & FAMILY" />
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                  {['Want kids','Open to it','No kids','Have kids'].map(v => (
                    <Squircle key={v} style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                      <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>{v}</Text>
                    </Squircle>
                  ))}
                </View>
              </Squircle>
              <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <SecHead title="LIFESTYLE" />
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                  {['Never drinks','Drinks socially','Drinks often','Never smokes','Smokes socially'].map(v => (
                    <Squircle key={v} style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                      <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>{v}</Text>
                    </Squircle>
                  ))}
                </View>
              </Squircle>
              <Squircle style={styles.filterCard} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                <View style={styles.proFeatureRow}>
                  <SecHead title="ACTIVE RECENTLY" />
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                </View>
                <View style={[styles.filterChipRow, { marginTop: 12 }]}>
                  {['Online now','Last 24h','This week','This month'].map(v => (
                    <Squircle key={v} style={styles.filterChip} cornerRadius={16} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                      <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>{v}</Text>
                    </Squircle>
                  ))}
                </View>
              </Squircle>
            </View>

            {/* AI FEATURES label */}
            <Text style={[styles.filterSecHead, { color: colors.textSecondary, marginLeft: 2, marginTop: 6 }]}>AI FEATURES</Text>

            {/* AI feature cards — dimmed */}
            {[
              { icon: 'analytics-outline',   title: 'AI Compatibility Score',  sub: 'See your % match with each person before you swipe' },
              { icon: 'flash-outline',        title: 'Smart Deal-Breakers',     sub: 'Auto-filter anyone who breaks your non-negotiables' },
              { icon: 'pulse-outline',        title: 'AI Vibe Check',           sub: 'Find people with matching energy and communication style' },
              { icon: 'telescope-outline',    title: 'Personality Insights',    sub: 'Filter by MBTI, love language and attachment style' },
              { icon: 'trending-up-outline',  title: 'Boost Predictions',       sub: 'AI tells you the best time to boost your profile' },
            ].map(f => (
              <View key={f.title}>
                <Squircle style={[styles.filterCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                  <Squircle style={styles.proAiIcon} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
                    <Ionicons name={f.icon as any} size={20} color={colors.text} />
                  </Squircle>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.proAiTitle, { color: colors.text }]}>{f.title}</Text>
                    <Text style={[styles.proAiSub, { color: colors.textSecondary }]}>{f.sub}</Text>
                  </View>
                  <Ionicons name="lock-closed" size={13} color={colors.textSecondary} />
                </Squircle>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={[styles.sheetFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 20), backgroundColor: colors.bg, gap: 10 }]}>
          {activeTab === 'basic' ? (
            <>
              {/* Upsell banner — grey only */}
              <Pressable onPress={() => setActiveTab('pro')}>
                <Squircle style={styles.upsellBanner} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                  <View style={styles.upsellLeft}>
                    <Squircle style={styles.upsellIconWrap} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
                      <Ionicons name="sparkles" size={15} color={colors.text} />
                    </Squircle>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.upsellTitle, { color: colors.text }]}>Unlock Advanced Filters</Text>
                      <Text style={[styles.upsellSub, { color: colors.textSecondary }]}>Education, lifestyle, looking for & more</Text>
                    </View>
                  </View>
                  <Squircle style={styles.upsellBtn} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                    <Text style={[styles.upsellBtnText, { color: colors.text }]}>Pro</Text>
                  </Squircle>
                </Squircle>
              </Pressable>
              {/* Apply */}
              <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} style={styles.applyBtn}>
                <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[styles.applyBtnText, { color: colors.bg }]}>Apply Filters</Text>
                </Pressable>
              </Squircle>
            </>
          ) : (
            /* Unlock Pro button — disabled style */
            <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1} style={[styles.applyBtn, { opacity: 0.5 }]}>
              <Pressable onPress={() => Alert.alert('Zod Pro', 'Subscribe to unlock all pro filters and AI features.')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                <Text style={[styles.applyBtnText, { color: colors.textSecondary }]}>Unlock Pro</Text>
              </Pressable>
            </Squircle>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Liked You Page ───────────────────────────────────────────────────────────

function LikedYouPage({ colors, insets }: { colors: any; insets: any }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Liked You</Text>
      <Text style={[styles.pageSub, { color: colors.textSecondary }]}>People who already like you</Text>
      <View style={styles.likedGrid}>
        {LIKED_PROFILES.map(p => (
          <View key={p.id} style={[styles.likedCard, { backgroundColor: colors.surface }]}>
            <Image source={{ uri: p.images[0] }} style={styles.likedPhoto} resizeMode="cover" />
            {/* Heart badge */}
            <View style={styles.likedBadge}>
              <Ionicons name="heart" size={12} color="#fff" />
            </View>
            {/* Blur bottom */}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.likedGrad}>
              <Text style={styles.likedName}>{p.name}, {p.age}</Text>
              {p.verified && <Ionicons name="checkmark-circle" size={12} color="#4FC3F7" />}
            </LinearGradient>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── AI Match Page ────────────────────────────────────────────────────────────

const AI_PICKS = [
  { profile: PROFILES[1], score: 94, sharedInterests: ['Art','Books','Coffee'], reason: "You both love creative expression and quiet, meaningful moments. Elena's curiosity matches your energy perfectly." },
  { profile: PROFILES[4], score: 87, sharedInterests: ['Travel','Photography','Wine'], reason: "Zara's adventurous spirit and your love of exploring new places make this a natural match." },
  { profile: PROFILES[2], score: 79, sharedInterests: ['Food','Travel'], reason: "Maya's Miami energy and your shared love for food and experiences create an exciting connection." },
];

function AiMatchPage({ colors, insets }: { colors: any; insets: any }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90, gap: 16 }} showsVerticalScrollIndicator={false}>
      <View style={{ marginBottom: 4 }}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>AI Matches</Text>
        <Text style={[styles.pageSub, { color: colors.textSecondary }]}>Curated picks based on your profile</Text>
      </View>

      {AI_PICKS.map(({ profile, score, sharedInterests, reason }) => (
        <View key={profile.id} style={[styles.aiCard, { backgroundColor: colors.surface }]}>
          <View style={styles.aiCardTop}>
            <Image source={{ uri: profile.images[0] }} style={styles.aiPhoto} resizeMode="cover" />
            <View style={styles.aiInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.aiName, { color: colors.text }]}>{profile.name}, {profile.age}</Text>
                {profile.verified && <Ionicons name="checkmark-circle" size={14} color="#4FC3F7" />}
              </View>
              <Text style={[styles.aiLocation, { color: colors.textSecondary }]}>{profile.distance} away</Text>
              {/* Score bar */}
              <View style={{ gap: 4, marginTop: 8 }}>
                <Text style={[styles.aiScoreLabel, { color: colors.textSecondary }]}>Compatibility</Text>
                <View style={[styles.aiScoreTrack, { backgroundColor: colors.surface2 }]}>
                  <LinearGradient colors={['#a855f7','#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.aiScoreFill, { width: `${score}%` as any }]} />
                </View>
                <Text style={[styles.aiScoreNum, { color: colors.text }]}>{score}% match</Text>
              </View>
            </View>
          </View>

          <View style={[styles.aiDivider, { backgroundColor: colors.border }]} />

          {/* Shared interests */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.aiSecLabel, { color: colors.textSecondary }]}>SHARED INTERESTS</Text>
            <View style={styles.chipRow}>
              {sharedInterests.map(i => (
                <View key={i} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{i}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.aiDivider, { backgroundColor: colors.border }]} />

          {/* Why we matched */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.aiSecLabel, { color: colors.textSecondary }]}>WHY YOU MATCH</Text>
            <Text style={[styles.aiReason, { color: colors.text }]}>{reason}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Chats Page ───────────────────────────────────────────────────────────────

const NEW_MATCHES = [
  { id:'m1', name:'Sophia',  image:'https://randomuser.me/api/portraits/women/44.jpg' },
  { id:'m2', name:'Elena',   image:'https://randomuser.me/api/portraits/women/68.jpg' },
  { id:'m3', name:'Maya',    image:'https://randomuser.me/api/portraits/women/50.jpg' },
  { id:'m4', name:'Zara',    image:'https://randomuser.me/api/portraits/women/32.jpg' },
];

const CONVERSATIONS = [
  { id:'c1', name:'Sophia',  image:'https://randomuser.me/api/portraits/women/44.jpg', preview:"Order dessert before checking the menu 🍰", time:'2m',  unread:3 },
  { id:'c2', name:'Elena',   image:'https://randomuser.me/api/portraits/women/68.jpg', preview:"That's so true! When are you free?",          time:'1h',  unread:0 },
  { id:'c3', name:'Maya',    image:'https://randomuser.me/api/portraits/women/50.jpg', preview:"Miami has the best sunsets ☀️",               time:'3h',  unread:1 },
  { id:'c4', name:'Aria',    image:'https://randomuser.me/api/portraits/women/79.jpg', preview:"Haha I would never lie about tacos 🌮",       time:'1d',  unread:0 },
];

function ChatsPage({ colors, insets }: { colors: any; insets: any }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Chats</Text>
      </View>

      {/* New Matches row */}
      <View style={{ paddingLeft: 16, marginBottom: 20 }}>
        <Text style={[styles.chatSecLabel, { color: colors.textSecondary }]}>NEW MATCHES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 16, marginTop: 12 }}>
          {NEW_MATCHES.map(m => (
            <View key={m.id} style={{ alignItems: 'center', gap: 6 }}>
              <View style={styles.matchAvatarWrap}>
                <Image source={{ uri: m.image }} style={styles.matchAvatar} />
                <View style={[styles.matchDot, { backgroundColor: '#00C853' }]} />
              </View>
              <Text style={[styles.matchName, { color: colors.text }]}>{m.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Messages */}
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={[styles.chatSecLabel, { color: colors.textSecondary }]}>MESSAGES</Text>
        <View style={{ marginTop: 12, gap: 2 }}>
          {CONVERSATIONS.map((c, i) => (
            <View key={c.id}>
              <Pressable style={({ pressed }) => [styles.convRow, pressed && { opacity: 0.7 }]}>
                <Image source={{ uri: c.image }} style={styles.convAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={styles.convTopRow}>
                    <Text style={[styles.convName, { color: colors.text }]}>{c.name}</Text>
                    <Text style={[styles.convTime, { color: colors.textSecondary }]}>{c.time}</Text>
                  </View>
                  <Text style={[styles.convPreview, { color: colors.textSecondary }]} numberOfLines={1}>{c.preview}</Text>
                </View>
                {c.unread > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.text }]}>
                    <Text style={[styles.unreadText, { color: colors.bg }]}>{c.unread}</Text>
                  </View>
                )}
              </Pressable>
              {i < CONVERSATIONS.length - 1 && <View style={[styles.convDivider, { backgroundColor: colors.border }]} />}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Main FeedScreen shell ────────────────────────────────────────────────────

export default function FeedScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [profiles,    setProfiles]    = useState<Profile[]>(PROFILES);
  const [activeTab,   setActiveTab]   = useState('people');
  const [filterOpen,  setFilterOpen]  = useState(false);

  const removeTop = () => setProfiles(p => p.slice(1));
  const reset     = () => setProfiles(PROFILES);

  const showTopBar = activeTab === 'people';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>

      {/* Top bar — only on People tab */}
      {showTopBar && (
      <View style={styles.topBar}>
          <Squircle style={styles.iconBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
          <Ionicons name="menu" size={20} color={colors.text} />
        </Squircle>
          <AppLogo color={colors.text} />
          <Pressable onPress={() => setFilterOpen(true)}>
            <Squircle style={styles.iconBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.surface2}>
          <Ionicons name="options-outline" size={20} color={colors.text} />
        </Squircle>
          </Pressable>
      </View>
      )}

      {/* Tab content */}
      {activeTab === 'people' && (
      <View style={styles.cardStack}>
        {profiles.length === 0 ? (
          <EmptyState onReset={reset} colors={colors} />
        ) : (
            <ProfileCard
              key={profiles[0].id}
              profile={profiles[0]}
                onSwipedLeft={removeTop}
                onSwipedRight={removeTop}
              colors={colors}
              />
        )}
      </View>
      )}

      {activeTab === 'likeyou' && <View style={{ flex: 1 }}><LikedYouPage  colors={colors} insets={insets} /></View>}
      {activeTab === 'ai'      && <View style={{ flex: 1 }}><AiMatchPage   colors={colors} insets={insets} /></View>}
      {activeTab === 'chats'   && <View style={{ flex: 1 }}><ChatsPage     colors={colors} insets={insets} /></View>}
      {activeTab === 'profile' && <View style={{ flex: 1 }}><MyProfilePage colors={colors} insets={insets} /></View>}

      {/* Sticky bottom tab bar */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {NAV_TABS.map(item => {
          const active    = activeTab === item.id;
          const isProfile = item.id === 'profile';
          return (
            <Pressable key={item.id} onPress={() => setActiveTab(item.id)} style={styles.navItem} hitSlop={8}>
              <View style={styles.navIconWrap}>
                {isProfile ? (
                  <View style={[styles.avatarWrap, active && { borderWidth: 2, borderColor: colors.text }]}>
                    <Image source={{ uri: MY_AVATAR }} style={styles.avatarImg} />
        </View>
                ) : (
                  <Ionicons name={active ? item.iconActive : item.icon} size={22} color={active ? colors.text : colors.textSecondary} />
                )}
                {item.badge && (
                  <View style={[styles.badge, { backgroundColor: colors.text }]}>
                    <Text style={[styles.badgeText, { color: colors.bg }]}>{item.badge}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Filter sheet */}
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} colors={colors} insets={insets} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column' },

  // Top bar
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },

  // Card stack
  cardStack: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  card:      { position: 'absolute', width: CARD_W, height: CARD_H, borderRadius: 28, overflow: 'hidden', backgroundColor: '#111' },

  // Photo section
  photoContainer: { width: CARD_W, height: PHOTO_H },
  photo:          { width: CARD_W, height: PHOTO_H },
  photoInfo:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 4 },
  premiumBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  premiumText:    { color: '#FFD60A', fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  nameRow:        { flexDirection: 'row', alignItems: 'center' },
  photoName:      { fontSize: 28, fontFamily: 'ProductSans-Black', color: '#fff' },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText:   { fontSize: 13, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  scrollHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  scrollHintText: { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.55)' },

  // LIKE / NOPE stamps
  likeStamp:     { position: 'absolute', top: 52, left: 24, zIndex: 20, borderWidth: 4, borderColor: '#00E676', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '-22deg' }], backgroundColor: 'rgba(0,230,118,0.08)' },
  likeStampText: { color: '#00E676', fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },
  nopeStamp:     { position: 'absolute', top: 52, right: 24, zIndex: 20, borderWidth: 4, borderColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, transform: [{ rotate: '22deg' }], backgroundColor: 'rgba(255,59,48,0.08)' },
  nopeStampText: { color: '#FF3B30', fontSize: 32, fontFamily: 'ProductSans-Black', letterSpacing: 3 },

  // Detail sections
  detailsSection: { paddingHorizontal: 16, paddingTop: 18 },
  sec:            { gap: 10, marginBottom: 4 },
  secLabel:       { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  aboutText:      { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  divider:        { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  promptCard:     { borderRadius: 14, padding: 14, gap: 6, marginBottom: 4 },
  promptQ:        { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.3 },
  promptA:        { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21 },
  lookingRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  lookingText:    { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  chipEmoji:      { fontSize: 15 },
  chipLabel:      { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  detailGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailChip:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  detailLabel:    { fontSize: 10, fontFamily: 'ProductSans-Regular' },
  detailValue:    { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  dangerRow:      { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  dangerBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  dangerBtnText:  { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  workRow:        { flexDirection: 'row', gap: 10 },
  workCard:       { flex: 1, flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, padding: 12 },
  workLabel:      { fontSize: 10, fontFamily: 'ProductSans-Regular', marginBottom: 2 },
  workValue:      { fontSize: 13, fontFamily: 'ProductSans-Bold', lineHeight: 18 },
  locationCardCity: { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  locationCardDist: { fontSize: 13, fontFamily: 'ProductSans-Regular' },
  inlinePhoto:      { width: '100%', height: 260, borderRadius: 16 },

  // Sticky bottom tab bar
  bottomNav:   { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  navItem:     { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 },
  navIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarWrap:  { width: 30, height: 30, borderRadius: 15, overflow: 'hidden' },
  avatarImg:   { width: 30, height: 30, borderRadius: 15 },
  badge:       { position: 'absolute', top: -5, right: -9, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:   { fontSize: 9, fontFamily: 'ProductSans-Bold' },

  // Empty state
  emptyWrap:    { alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  emptyIcon:    { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 20, fontFamily: 'ProductSans-Black', textAlign: 'center' },
  emptySub:     { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center', lineHeight: 21 },
  resetBtn:     { flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 22 },
  resetBtnText: { fontSize: 15, fontFamily: 'ProductSans-Medium' },

  // Filter sheet
  sheetContainer:   { flex: 1 },
  sheetHeader:      { paddingHorizontal: 20, paddingBottom: 16 },
  sheetHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle:       { fontSize: 18, fontFamily: 'ProductSans-Black' },
  sheetClose:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetResetText:   { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  sheetFooter:      { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  applyBtn:         { height: 52, overflow: 'hidden' },
  applyBtnText:     { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  filterTabRow:     { flexDirection: 'row', borderRadius: 18, padding: 4, gap: 4, overflow: 'hidden' },
  filterTabActive:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  filterTabInactive:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  filterTabText:    { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  filterCard:       { padding: 16 },
  filterRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterRowIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  filterRowTitle:   { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  filterRowSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  filterSecHead:    { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  filterChipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 5 },
  filterChipText:   { fontSize: 13, fontFamily: 'ProductSans-Medium' },
  upsellBanner:     { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  upsellLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  upsellIconWrap:   { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  upsellTitle:      { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  upsellSub:        { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 1 },
  upsellBtn:        { paddingHorizontal: 14, paddingVertical: 8 },
  upsellBtnText:    { fontSize: 12, fontFamily: 'ProductSans-Bold' },
  sliderLabelRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderValue:      { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  sliderRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderSub:        { fontSize: 12, fontFamily: 'ProductSans-Medium', minWidth: 28 },
  sliderEdgeRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderEdge:       { fontSize: 11, fontFamily: 'ProductSans-Medium', minWidth: 20, textAlign: 'center' },
  proHeaderCard:    { padding: 16 },
  proHeaderRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proHeaderIcon:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  proHeaderTitle:   { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  proHeaderSub:     { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  proLockBadge:     { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  proFeatureRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proFakeFill:      { height: 26, justifyContent: 'center', position: 'relative' },
  proFakeTrack:     { height: 4, borderRadius: 2, position: 'absolute', left: 0, right: 0 },
  proFakeActive:    { height: 4, borderRadius: 2, position: 'absolute' },
  proFakeThumb:     { width: 22, height: 22, borderRadius: 11, position: 'absolute', top: 2 },
  proAiIcon:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  proAiTitle:       { fontSize: 14, fontFamily: 'ProductSans-Bold' },
  proAiSub:         { fontSize: 11, fontFamily: 'ProductSans-Regular', marginTop: 2, lineHeight: 16 },

  // Liked you
  pageTitle:   { fontSize: 24, fontFamily: 'ProductSans-Black' },
  pageSub:     { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 2, marginBottom: 16 },
  likedGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  likedCard:   { width: (W - 42) / 2, borderRadius: 18, overflow: 'hidden', height: 240 },
  likedPhoto:  { width: '100%', height: '100%' },
  likedBadge:  { position: 'absolute', top: 10, right: 10, backgroundColor: '#ec4899', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  likedGrad:   { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: 12, paddingBottom: 14 },
  likedName:   { fontSize: 14, fontFamily: 'ProductSans-Bold', color: '#fff' },

  // AI match
  aiCard:      { borderRadius: 20, padding: 16, gap: 12 },
  aiCardTop:   { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  aiPhoto:     { width: 80, height: 80, borderRadius: 16 },
  aiInfo:      { flex: 1 },
  aiName:      { fontSize: 16, fontFamily: 'ProductSans-Black' },
  aiLocation:  { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  aiScoreLabel:{ fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1 },
  aiScoreTrack:{ height: 6, borderRadius: 3, overflow: 'hidden' },
  aiScoreFill: { height: 6, borderRadius: 3 },
  aiScoreNum:  { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  aiDivider:   { height: StyleSheet.hairlineWidth },
  aiSecLabel:  { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  aiReason:    { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21 },

  // Chats
  chatSecLabel:    { fontSize: 10, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5 },
  matchAvatarWrap: { width: 62, height: 62, borderRadius: 31, position: 'relative' },
  matchAvatar:     { width: 62, height: 62, borderRadius: 31 },
  matchDot:        { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  matchName:       { fontSize: 12, fontFamily: 'ProductSans-Medium', textAlign: 'center' },
  convRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  convAvatar:      { width: 54, height: 54, borderRadius: 27 },
  convTopRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName:        { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  convTime:        { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  convPreview:     { fontSize: 13, fontFamily: 'ProductSans-Regular', marginTop: 3 },
  convDivider:     { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  unreadBadge:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  unreadText:      { fontSize: 10, fontFamily: 'ProductSans-Bold' },

});
