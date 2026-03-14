/**
 * Static mirror of the lookup_options + relationship_types database tables.
 * IDs are stable once seeded. Update this file if new options are added to the DB.
 *
 * Usage:
 *   import { LOOKUP, RELATIONSHIP_TYPES, getLookupLabel, getLookupId } from '@/constants/lookupData';
 *
 *   // Get label for a stored ID
 *   getLookupLabel('gender', profile.gender_id)  // → "Man"
 *
 *   // Get ID for a label (for saving)
 *   getLookupId('gender', 'Man')  // → 223
 */

export interface LookupItem {
  id: number;
  emoji?: string;
  label: string;
}

export interface RelationshipType {
  id: number;
  value: string;
  label: string;
}

// ── Relationship types (for purpose field) ──────────────────────────────────
export const RELATIONSHIP_TYPES: RelationshipType[] = [
  { id: 1, value: 'relationship', label: 'Long-term relationship' },
  { id: 2, value: 'casual',       label: 'Something casual' },
  { id: 3, value: 'open',         label: 'Open relationship' },
  { id: 4, value: 'friends',      label: 'New friends' },
  { id: 5, value: 'unsure',       label: 'Not sure yet' },
];

// ── All lookup_options by category ─────────────────────────────────────────
export const LOOKUP: Record<string, LookupItem[]> = {
  gender: [
    { id: 223, emoji: '♂️',  label: 'Male' },
    { id: 224, emoji: '♀️',  label: 'Female' },
  ],

  interests: [
    { id: 227, emoji: '🥾',  label: 'Hiking' },
    { id: 228, emoji: '✈️',  label: 'Travel' },
    { id: 229, emoji: '🍳',  label: 'Cooking' },
    { id: 230, emoji: '💪',  label: 'Fitness' },
    { id: 231, emoji: '🎵',  label: 'Music' },
    { id: 232, emoji: '🎨',  label: 'Art' },
    { id: 233, emoji: '🎮',  label: 'Gaming' },
    { id: 234, emoji: '📚',  label: 'Reading' },
    { id: 235, emoji: '📸',  label: 'Photography' },
    { id: 236, emoji: '💃',  label: 'Dancing' },
    { id: 237, emoji: '🧘',  label: 'Yoga' },
    { id: 238, emoji: '🎬',  label: 'Movies' },
    { id: 239, emoji: '☕',  label: 'Coffee' },
    { id: 240, emoji: '🍷',  label: 'Wine' },
    { id: 241, emoji: '🏄',  label: 'Surfing' },
    { id: 242, emoji: '🚴',  label: 'Cycling' },
    { id: 243, emoji: '🧠',  label: 'Meditation' },
    { id: 244, emoji: '🍽️', label: 'Foodie' },
    { id: 245, emoji: '🐶',  label: 'Dogs' },
    { id: 246, emoji: '🐱',  label: 'Cats' },
    { id: 247, emoji: '❤️',  label: 'Volunteering' },
    { id: 248, emoji: '👗',  label: 'Fashion' },
    { id: 249, emoji: '🎤',  label: 'Concerts' },
    { id: 250, emoji: '⛺',  label: 'Camping' },
  ],

  values_list: [
    { id: 251, label: 'Loyalty' },
    { id: 252, label: 'Honesty' },
    { id: 253, label: 'Humor' },
    { id: 254, label: 'Ambition' },
    { id: 255, label: 'Kindness' },
    { id: 256, label: 'Intelligence' },
    { id: 257, label: 'Drive' },
    { id: 258, label: 'Open-mindedness' },
    { id: 259, label: 'Confidence' },
    { id: 260, label: 'Creativity' },
    { id: 261, label: 'Empathy' },
    { id: 262, label: 'Resilience' },
    { id: 263, label: 'Authenticity' },
    { id: 264, label: 'Growth mindset' },
    { id: 265, label: 'Passion' },
    { id: 266, label: 'Courage' },
    // Life goals (GoalsScreen also saves to values_list)
    { id: 267, emoji: '✈️',  label: 'Travel the world' },
    { id: 268, emoji: '👨‍👩‍👧', label: 'Build a family' },
    { id: 269, emoji: '💼',  label: 'Grow my career' },
    { id: 270, emoji: '🌱',  label: 'Personal growth' },
    { id: 271, emoji: '🎨',  label: 'Creative pursuits' },
    { id: 272, emoji: '💰',  label: 'Financial stability' },
    { id: 273, emoji: '🤝',  label: 'Community & giving' },
    { id: 274, emoji: '🏄',  label: 'Adventure & thrills' },
    { id: 275, emoji: '🧘',  label: 'Mindfulness & health' },
  ],

  causes: [
    { id: 276, emoji: '🌍',  label: 'Environment' },
    { id: 277, emoji: '📚',  label: 'Education' },
    { id: 278, emoji: '🤝',  label: 'Volunteering' },
    { id: 279, emoji: '🏥',  label: 'Healthcare' },
    { id: 280, emoji: '♻️',  label: 'Sustainability' },
    { id: 281, emoji: '🐾',  label: 'Animal Rights' },
    { id: 282, emoji: '⚖️',  label: 'Social Justice' },
    { id: 283, emoji: '🏠',  label: 'Homelessness' },
    { id: 284, emoji: '🧠',  label: 'Mental Health' },
    { id: 285, emoji: '👶',  label: 'Children & Youth' },
  ],

  diet: [
    { id: 286, emoji: '🍽️', label: 'No restrictions' },
    { id: 287, emoji: '🥗',  label: 'Vegetarian' },
    { id: 288, emoji: '🌱',  label: 'Vegan' },
    { id: 289, emoji: '☪️',  label: 'Halal' },
    { id: 290, emoji: '✡️',  label: 'Kosher' },
    { id: 291, emoji: '🌾',  label: 'Gluten-free' },
    { id: 292, emoji: '🥛',  label: 'Dairy-free' },
  ],

  drinking: [
    { id: 12, emoji: '🚫',  label: 'Never' },
    { id: 13, emoji: '🥂',  label: 'Socially' },
    { id: 14, emoji: '🍺',  label: 'Regularly' },
  ],

  smoking: [
    { id: 15, emoji: '🚫',  label: 'Never' },
    { id: 16, emoji: '💨',  label: 'Socially' },
    { id: 17, emoji: '🚬',  label: 'Regularly' },
    { id: 18, emoji: '✅',  label: 'Yes' },
  ],

  exercise: [
    { id: 1,  emoji: '🧘',  label: 'Never' },
    { id: 2,  emoji: '🚶',  label: 'Sometimes' },
    { id: 3,  emoji: '💪',  label: 'Often' },
    { id: 4,  emoji: '🏃',  label: 'Every day' },
  ],

  education_level: [
    { id: 5,  emoji: '🏫',  label: 'High School' },
    { id: 6,  emoji: '📚',  label: 'Some College' },
    { id: 7,  emoji: '🎓',  label: "Associate's" },
    { id: 8,  emoji: '🎓',  label: "Bachelor's" },
    { id: 9,  emoji: '🎓',  label: "Master's" },
    { id: 10, emoji: '🔬',  label: 'PhD' },
    { id: 11, emoji: '📋',  label: 'Other' },
  ],

  looking_for: [
    { id: 19, emoji: '☕',  label: 'Casual dating' },
    { id: 20, emoji: '💍',  label: 'Something serious' },
    { id: 21, emoji: '💒',  label: 'Marriage' },
    { id: 22, emoji: '🤷',  label: 'Open to it' },
    { id: 23, emoji: '🤝',  label: 'Friends first' },
  ],

  family_plans: [
    { id: 24, emoji: '👶',       label: 'Want kids' },
    { id: 25, emoji: '🤷',       label: 'Open to it' },
    { id: 26, emoji: '🚫',       label: "Don't want kids" },
    { id: 27, emoji: '👨‍👩‍👧',  label: 'Have kids' },
  ],

  have_kids: [
    { id: 28, emoji: '🚫',  label: 'No' },
    { id: 29, emoji: '🏠',  label: 'Yes, live with me' },
    { id: 30, emoji: '📍',  label: 'Yes, elsewhere' },
  ],

  star_sign: [
    { id: 31, emoji: '♈',  label: 'Aries' },
    { id: 32, emoji: '♉',  label: 'Taurus' },
    { id: 33, emoji: '♊',  label: 'Gemini' },
    { id: 34, emoji: '♋',  label: 'Cancer' },
    { id: 35, emoji: '♌',  label: 'Leo' },
    { id: 36, emoji: '♍',  label: 'Virgo' },
    { id: 37, emoji: '♎',  label: 'Libra' },
    { id: 38, emoji: '♏',  label: 'Scorpio' },
    { id: 39, emoji: '♐',  label: 'Sagittarius' },
    { id: 40, emoji: '♑',  label: 'Capricorn' },
    { id: 41, emoji: '♒',  label: 'Aquarius' },
    { id: 42, emoji: '♓',  label: 'Pisces' },
  ],

  religion: [
    { id: 43, emoji: '🤔',  label: 'Agnostic' },
    { id: 44, emoji: '🧠',  label: 'Atheist' },
    { id: 45, emoji: '☸️',  label: 'Buddhist' },
    { id: 46, emoji: '✝️',  label: 'Christian' },
    { id: 47, emoji: '🕉️',  label: 'Hindu' },
    { id: 48, emoji: '✡️',  label: 'Jewish' },
    { id: 49, emoji: '☪️',  label: 'Muslim' },
    { id: 50, emoji: '🌟',  label: 'Spiritual' },
    { id: 51, emoji: '🌐',  label: 'Other' },
  ],

  ethnicity: [
    { id: 300, label: 'Arab' },
    { id: 301, label: 'Black / African' },
    { id: 302, label: 'East Asian' },
    { id: 303, label: 'Hispanic / Latino' },
    { id: 304, label: 'Indian / South Asian' },
    { id: 305, label: 'Middle Eastern' },
    { id: 306, label: 'Mixed / Multiracial' },
    { id: 307, label: 'Native / Indigenous' },
    { id: 308, label: 'Pacific Islander' },
    { id: 309, label: 'Southeast Asian' },
    { id: 310, label: 'White / Caucasian' },
    { id: 311, label: 'Other' },
  ],

  language: [
    { id: 52, emoji: '🇬🇧',  label: 'English' },
    { id: 53, emoji: '🇪🇸',  label: 'Spanish' },
    { id: 54, emoji: '🇫🇷',  label: 'French' },
    { id: 55, emoji: '🇩🇪',  label: 'German' },
    { id: 56, emoji: '🇧🇷',  label: 'Portuguese' },
    { id: 57, emoji: '🇮🇹',  label: 'Italian' },
    { id: 58, emoji: '🇸🇦',  label: 'Arabic' },
    { id: 59, emoji: '🇨🇳',  label: 'Mandarin' },
    { id: 60, emoji: '🇯🇵',  label: 'Japanese' },
    { id: 61, emoji: '🇰🇷',  label: 'Korean' },
    { id: 62, emoji: '🇮🇳',  label: 'Hindi' },
    { id: 63, emoji: '🇷🇺',  label: 'Russian' },
    { id: 64, emoji: '🇳🇱',  label: 'Dutch' },
    { id: 65, emoji: '🇸🇪',  label: 'Swedish' },
    { id: 66, emoji: '🇵🇱',  label: 'Polish' },
    { id: 67, emoji: '🇹🇷',  label: 'Turkish' },
  ],

  work_matching_goals: [
    { id: 68, emoji: '🤝',  label: 'Looking for co-founder' },
    { id: 69, emoji: '💡',  label: 'Have an idea, open to explore' },
    { id: 70, emoji: '🔭',  label: 'Exploring new ideas' },
    { id: 71, emoji: '💬',  label: 'Open to chatting' },
  ],

  work_commitment_level: [
    { id: 72, emoji: '🚀',  label: 'Already full-time on a startup' },
    { id: 73, emoji: '⚡',  label: 'Ready to go full-time right now with right co-founder' },
    { id: 74, emoji: '📅',  label: 'Ready to go full-time in the next year' },
    { id: 75, emoji: '🌱',  label: 'No specific startup plans yet' },
  ],

  work_equity_split: [
    { id: 76, emoji: '🤲',  label: 'Fully negotiable' },
    { id: 77, emoji: '⚖️',  label: 'Equal split' },
    { id: 78, emoji: '📊',  label: 'Willing to accept a specific equity %' },
    { id: 79, emoji: '💼',  label: 'Equity + salary compensation both' },
    { id: 80, emoji: '💵',  label: 'Compensation only' },
  ],

  work_skills: [
    { id: 109, emoji: '📦',  label: 'Product' },
    { id: 110, emoji: '🎨',  label: 'Design' },
    { id: 111, emoji: '💻',  label: 'Engineering' },
    { id: 112, emoji: '📣',  label: 'Sales' },
    { id: 113, emoji: '📈',  label: 'Marketing' },
    { id: 114, emoji: '⚙️',  label: 'Operations' },
    { id: 115, emoji: '💰',  label: 'Finance' },
    { id: 116, emoji: '⚖️',  label: 'Legal' },
    { id: 117, emoji: '📊',  label: 'Data & Analytics' },
    { id: 118, emoji: '🚀',  label: 'Growth' },
    { id: 119, emoji: '🤝',  label: 'Fundraising' },
    { id: 120, emoji: '🗺️',  label: 'Strategy' },
    { id: 121, emoji: '🌐',  label: 'Business Development' },
    { id: 122, emoji: '😊',  label: 'Customer Success' },
    { id: 123, emoji: '✍️',  label: 'Content' },
    { id: 124, emoji: '🤖',  label: 'AI / ML' },
    { id: 125, emoji: '⛓️',  label: 'Blockchain' },
    { id: 126, emoji: '🔒',  label: 'Cybersecurity' },
    { id: 127, emoji: '📡',  label: 'DevOps / Infra' },
    { id: 128, emoji: '📱',  label: 'Mobile' },
  ],

  work_industries: [
    { id: 81,  emoji: '🤖',  label: 'AI' },
    { id: 82,  emoji: '📢',  label: 'Advertising' },
    { id: 83,  emoji: '🎬',  label: 'Entertainment' },
    { id: 84,  emoji: '💳',  label: 'Fintech' },
    { id: 85,  emoji: '🏥',  label: 'Healthtech' },
    { id: 86,  emoji: '🛒',  label: 'E-commerce' },
    { id: 87,  emoji: '🎓',  label: 'Education' },
    { id: 88,  emoji: '☁️',  label: 'SaaS' },
    { id: 89,  emoji: '🎮',  label: 'Gaming' },
    { id: 90,  emoji: '⛓️',  label: 'Web3' },
    { id: 91,  emoji: '📰',  label: 'Media' },
    { id: 92,  emoji: '🏠',  label: 'Real Estate' },
    { id: 93,  emoji: '🔬',  label: 'Deep Tech' },
    { id: 94,  emoji: '🌍',  label: 'Climate Tech' },
    { id: 95,  emoji: '👤',  label: 'Consumer' },
    { id: 96,  emoji: '🏢',  label: 'B2B' },
    { id: 97,  emoji: '🏪',  label: 'Marketplace' },
    { id: 98,  emoji: '🛠️',  label: 'Developer Tools' },
    { id: 99,  emoji: '🔐',  label: 'Cybersecurity' },
    { id: 100, emoji: '🚚',  label: 'Logistics' },
    { id: 101, emoji: '✈️',  label: 'Travel' },
    { id: 102, emoji: '🍽️', label: 'Food & Beverage' },
    { id: 103, emoji: '👗',  label: 'Fashion' },
    { id: 104, emoji: '⚽',  label: 'Sports' },
    { id: 105, emoji: '🏦',  label: 'Insurance' },
    { id: 106, emoji: '⚖️',  label: 'Legaltech' },
    { id: 107, emoji: '🏗️',  label: 'Proptech' },
    { id: 108, emoji: '🚗',  label: 'Mobility' },
  ],

  work_who_to_show: [
    { id: 129, emoji: '🤝',  label: 'Founders & Talent' },
    { id: 130, emoji: '🚀',  label: 'Founders only' },
    { id: 131, emoji: '💼',  label: 'Talent only' },
    { id: 132, emoji: '🌐',  label: 'All' },
  ],

  work_stage: [
    { id: 145, emoji: '💡',  label: 'Idea stage' },
    { id: 146, emoji: '🌱',  label: 'Pre-seed' },
    { id: 147, emoji: '🌿',  label: 'Seed' },
    { id: 148, emoji: '🚀',  label: 'Series A+' },
    { id: 149, emoji: '💰',  label: 'Bootstrapped' },
  ],

  work_role: [
    { id: 150, emoji: '💻',  label: 'Technical' },
    { id: 151, emoji: '🎯',  label: 'Non-technical' },
    { id: 152, emoji: '🤝',  label: 'Both' },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Get the label for a given category + ID */
export function getLookupLabel(category: string, id: number | null | undefined): string {
  if (id == null) return '';
  return LOOKUP[category]?.find(item => item.id === id)?.label ?? '';
}

/** Get the ID for a given category + label */
export function getLookupId(category: string, label: string): number | undefined {
  return LOOKUP[category]?.find(item => item.label === label)?.id;
}

/** Resolve an array of IDs to their labels */
export function getLookupLabels(category: string, ids: number[] | null | undefined): string[] {
  if (!ids) return [];
  return ids.map(id => getLookupLabel(category, id)).filter(Boolean);
}

/** Resolve an array of relationship type IDs to labels */
export function getRelationshipLabels(ids: number[] | null | undefined): string[] {
  if (!ids) return [];
  return ids.map(id => RELATIONSHIP_TYPES.find(rt => rt.id === id)?.label ?? '').filter(Boolean);
}
