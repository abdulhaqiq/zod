/**
 * Ionicons name → Lineicons icon mapping.
 * Every <Ionicons name="xyz"> used in the codebase maps to a Lineicons icon here.
 * Unmapped names return null and render nothing — add them as needed.
 */
import {
  // ── Hearts & social ───────────────────────────────────────────────────────
  HeartOutlined,
  ThumbsUp3Outlined,
  ThumbsDown3Outlined,
  StarFatOutlined,
  StarFatHalf2Outlined,
  SparkOutlined,
  Trophy1Outlined,
  // ── People ────────────────────────────────────────────────────────────────
  User4Outlined,
  UserMultiple4Outlined,
  TargetUserOutlined,
  // ── Navigation / arrows ───────────────────────────────────────────────────
  ChevronLeftOutlined,
  ChevronDownOutlined,
  ChevronUpOutlined,
  ChevronDownCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpwardOutlined,
  ArrowDownwardOutlined,
  ArrowRightCircleOutlined,
  ArrowAngularTopLeftOutlined,
  // ── Close / X ─────────────────────────────────────────────────────────────
  XmarkOutlined,
  XmarkCircleOutlined,
  MinusOutlined,
  MinusCircleOutlined,
  // ── Check ─────────────────────────────────────────────────────────────────
  CheckOutlined,
  CheckCircle1Outlined,
  CheckSquare2Outlined,
  // ── Search ────────────────────────────────────────────────────────────────
  Search1Outlined,
  Search2Outlined,
  // ── Home & nav tabs ───────────────────────────────────────────────────────
  Home2Outlined,
  Layers1Outlined,
  // ── Messaging ─────────────────────────────────────────────────────────────
  ChatBubble2Outlined,
  Message2Outlined,
  Message3TextOutlined,
  Comment1Outlined,
  // ── Location ──────────────────────────────────────────────────────────────
  MapPin5Outlined,
  MapMarker1Outlined,
  // ── Camera / media ────────────────────────────────────────────────────────
  Camera1Outlined,
  CameraMovie1Outlined,
  PhotosOutlined,
  EyeOutlined,
  // ── Settings / tools ──────────────────────────────────────────────────────
  Gear1Outlined,
  SlidersHorizontalSquare2Outlined,
  PenToSquareOutlined,
  Pencil1Outlined,
  Trash3Outlined,
  PlusOutlined,
  MenuMeatballs1Outlined,
  MenuHamburger1Outlined,
  // ── Sync / refresh ────────────────────────────────────────────────────────
  SyncOutlined,
  RefreshCircle1ClockwiseOutlined,
  // ── Security / keys ───────────────────────────────────────────────────────
  Locked1Outlined,
  Unlocked2Outlined,
  Key1Outlined,
  Shield2Outlined,
  Shield2CheckOutlined,
  // ── Communication ─────────────────────────────────────────────────────────
  PhoneOutlined,
  Telephone1Outlined,
  Microphone1Outlined,
  Bell1Outlined,
  // ── Education / knowledge ─────────────────────────────────────────────────
  Book1Outlined,
  SchoolBench1Outlined,
  Bulb2Outlined,
  // ── Time ──────────────────────────────────────────────────────────────────
  CalendarDaysOutlined,
  StopwatchOutlined,
  WatchBeat1Outlined,
  HourglassBulk,
  // ── Globe / network ───────────────────────────────────────────────────────
  Globe1Outlined,
  WwwOutlined,
  Cloud2Outlined,
  // ── Finance ───────────────────────────────────────────────────────────────
  CreditCardMultipleOutlined,
  // ── Brands ────────────────────────────────────────────────────────────────
  AppleBrandOutlined,
  LinkedinOutlined,
  WhatsappOutlined,
  // ── Misc ──────────────────────────────────────────────────────────────────
  Flag1Outlined,
  Ban2Outlined,
  MoonHalfRight5Outlined,
  Rocket5Outlined,
  Megaphone1Outlined,
  Briefcase1Outlined,
  BoxGift1Outlined,
  GamePadModern1Outlined,
  Bolt2Outlined,
  QuestionMarkCircleOutlined,
  Share1Outlined,
  Share2Outlined,
  Paperclip1Outlined,
  Bookmark1Outlined,
  Buildings1Outlined,
  Ambulance1Outlined,
  BarChart4Outlined,
  MagicOutlined,
  Scissors1VerticalOutlined,
  Upload1Outlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  Aeroplane1Outlined,
} from '@lineiconshq/free-icons';

// ─── Mapping: Ionicons name → Lineicons icon object ───────────────────────────
export const ICON_MAP: Record<string, any> = {
  // Hearts / likes
  'heart':                      HeartOutlined,
  'heart-outline':               HeartOutlined,
  'heart-circle-outline':        HeartOutlined,
  'thumbs-up':                   ThumbsUp3Outlined,
  'thumbs-down':                 ThumbsDown3Outlined,

  // Stars / sparkles / fire
  'star':                        StarFatOutlined,
  'star-outline':                StarFatOutlined,
  'star-half-outline':           StarFatHalf2Outlined,
  'sparkles':                    SparkOutlined,
  'sparkles-outline':            SparkOutlined,
  'flame':                       SparkOutlined,
  'flash':                       Bolt2Outlined,
  'flash-outline':               Bolt2Outlined,
  'trophy':                      Trophy1Outlined,
  'trophy-outline':              Trophy1Outlined,

  // People / user
  'person':                      User4Outlined,
  'person-outline':              User4Outlined,
  'person-circle-outline':       User4Outlined,
  'person-remove-outline':       User4Outlined,
  'people':                      UserMultiple4Outlined,
  'people-outline':              UserMultiple4Outlined,
  'people-circle':               UserMultiple4Outlined,
  'people-circle-outline':       UserMultiple4Outlined,

  // Arrows / chevrons
  'chevron-back':                ChevronLeftOutlined,
  'chevron-down':                ChevronDownOutlined,
  'chevron-up':                  ChevronUpOutlined,
  'chevron-forward':             ArrowRightOutlined,
  'arrow-back':                  ChevronLeftOutlined,
  'arrow-forward':               ArrowRightOutlined,
  'arrow-up':                    ArrowUpwardOutlined,
  'arrow-down':                  ArrowDownwardOutlined,
  'arrow-down-circle-outline':   ChevronDownCircleOutlined,
  'arrow-undo':                  ArrowAngularTopLeftOutlined,
  'return-down-forward':         ArrowRightOutlined,
  'return-down-forward-outline': ArrowRightOutlined,

  // Close / dismiss
  'close':                       XmarkOutlined,
  'close-outline':               XmarkOutlined,
  'close-circle':                XmarkCircleOutlined,
  'close-circle-outline':        XmarkCircleOutlined,
  'remove':                      MinusOutlined,
  'remove-circle':               MinusCircleOutlined,

  // Check / done
  'checkmark':                   CheckOutlined,
  'checkmark-done':              CheckOutlined,
  'checkmark-circle':            CheckCircle1Outlined,
  'checkmark-circle-outline':    CheckCircle1Outlined,
  'checkbox-outline':            CheckSquare2Outlined,

  // Search
  'search':                      Search1Outlined,
  'search-outline':              Search1Outlined,
  'scan-outline':                Search2Outlined,

  // Home & nav
  'home':                        Home2Outlined,
  'home-outline':                Home2Outlined,
  'layers':                      Layers1Outlined,
  'layers-outline':              Layers1Outlined,

  // Messaging / chat
  'chatbubble':                  ChatBubble2Outlined,
  'chatbubble-outline':          ChatBubble2Outlined,
  'chatbubble-ellipses':         Message2Outlined,
  'chatbubbles-outline':         Message3TextOutlined,
  'chatbubbles':                 Message3TextOutlined,
  'chat':                        ChatBubble2Outlined,
  'send':                        ArrowRightCircleOutlined,
  'send-outline':                ArrowRightCircleOutlined,
  'paper-plane-outline':         ArrowRightCircleOutlined,
  'comment':                     Comment1Outlined,

  // Location / map
  'location':                    MapPin5Outlined,
  'location-outline':            MapPin5Outlined,
  'map-outline':                 MapMarker1Outlined,
  'navigate':                    ArrowUpwardOutlined,

  // Camera / media
  'camera-outline':              Camera1Outlined,
  'camera':                      Camera1Outlined,
  'videocam':                    CameraMovie1Outlined,
  'videocam-outline':            CameraMovie1Outlined,
  'image-outline':               PhotosOutlined,
  'images-outline':              PhotosOutlined,
  'image':                       PhotosOutlined,
  'eye':                         EyeOutlined,
  'eye-outline':                 EyeOutlined,
  'stop':                        StopwatchOutlined,

  // Settings / edit / tools
  'settings':                    Gear1Outlined,
  'settings-outline':            Gear1Outlined,
  'options-outline':             SlidersHorizontalSquare2Outlined,
  'filter':                      SlidersHorizontalSquare2Outlined,
  'create':                      PenToSquareOutlined,
  'create-outline':              PenToSquareOutlined,
  'pencil':                      Pencil1Outlined,
  'pencil-outline':              Pencil1Outlined,
  'trash-outline':               Trash3Outlined,
  'trash':                       Trash3Outlined,
  'add':                         PlusOutlined,
  'add-outline':                 PlusOutlined,
  'add-circle-outline':          PlusOutlined,
  'ellipsis-horizontal':         MenuMeatballs1Outlined,
  'ellipsis-horizontal-circle-outline': MenuMeatballs1Outlined,
  'menu':                        MenuHamburger1Outlined,
  'open-outline':                Share1Outlined,
  'share':                       Share1Outlined,
  'share-outline':               Share2Outlined,
  'attach':                      Paperclip1Outlined,
  'bookmark-outline':            Bookmark1Outlined,

  // Refresh / sync
  'refresh':                     SyncOutlined,
  'refresh-outline':             SyncOutlined,
  'reload':                      RefreshCircle1ClockwiseOutlined,

  // Security
  'lock-closed':                 Locked1Outlined,
  'lock-closed-outline':         Locked1Outlined,
  'lock-open-outline':           Unlocked2Outlined,
  'key':                         Key1Outlined,
  'key-outline':                 Key1Outlined,
  'shield-outline':              Shield2Outlined,
  'shield-checkmark':            Shield2CheckOutlined,
  'shield-checkmark-outline':    Shield2CheckOutlined,

  // Communication
  'phone':                       PhoneOutlined,
  'call':                        Telephone1Outlined,
  'mic':                         Microphone1Outlined,
  'mic-outline':                 Microphone1Outlined,
  'notifications':               Bell1Outlined,
  'notifications-outline':       Bell1Outlined,
  'mail-outline':                Message2Outlined,
  'mail-unread-outline':         Message2Outlined,

  // Education / info
  'book-outline':                Book1Outlined,
  'school-outline':              SchoolBench1Outlined,
  'bulb-outline':                Bulb2Outlined,
  'information-circle-outline':  QuestionMarkCircleOutlined,
  'alert-circle-outline':        QuestionMarkCircleOutlined,
  'help-circle-outline':         QuestionMarkCircleOutlined,
  'pulse':                       WatchBeat1Outlined,
  'pulse-outline':               WatchBeat1Outlined,

  // Time
  'calendar-outline':            CalendarDaysOutlined,
  'calendar':                    CalendarDaysOutlined,
  'time-outline':                StopwatchOutlined,
  'timer-outline':               StopwatchOutlined,
  'hourglass-outline':           StopwatchOutlined,

  // Globe / web
  'language-outline':            Globe1Outlined,
  'globe-outline':               Globe1Outlined,
  'globe':                       WwwOutlined,
  'wifi-outline':                Cloud2Outlined,
  'wifi':                        Cloud2Outlined,

  // Finance / card
  'card-outline':                CreditCardMultipleOutlined,
  'card':                        CreditCardMultipleOutlined,
  'wallet-outline':              CreditCardMultipleOutlined,

  // Brands
  'logo-apple':                  AppleBrandOutlined,
  'logo-linkedin':               LinkedinOutlined,
  'logo-whatsapp':               WhatsappOutlined,

  // Misc
  'flag-outline':                Flag1Outlined,
  'ban-outline':                 Ban2Outlined,
  'moon-outline':                MoonHalfRight5Outlined,
  'rocket-outline':              Rocket5Outlined,
  'megaphone-outline':           Megaphone1Outlined,
  'briefcase-outline':           Briefcase1Outlined,
  'briefcase':                   Briefcase1Outlined,
  'gift-outline':                BoxGift1Outlined,
  'game-controller':             GamePadModern1Outlined,
  'game-controller-outline':     GamePadModern1Outlined,
  'warning':                     Bolt2Outlined,
  'warning-outline':             Bolt2Outlined,
  'analytics':                   BarChart4Outlined,
  'analytics-outline':           BarChart4Outlined,
  'magic':                       MagicOutlined,
  'upload-outline':              Upload1Outlined,
  'cloud-upload-outline':        CloudUploadOutlined,
  'cloud-download-outline':      CloudDownloadOutlined,
  'airplane-outline':            Aeroplane1Outlined,
  'backspace-outline':           ChevronLeftOutlined,
  'list':                        MenuHamburger1Outlined,
  'list-outline':                MenuHamburger1Outlined,
};
