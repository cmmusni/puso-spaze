# Copilot Instructions — PUSO Spaze

## Platform: Web + Mobile (Expo / React Native)

This is a **universal Expo app** running on both **web** and **native (iOS/Android)**. Always consider both platforms when adding or modifying features.

### Key rules

- Use `Platform.OS` checks when behaviour must diverge between web and native (file uploads, navigation, CSS injection).
- Never use web-only APIs (`document`, `window`, DOM) without guarding behind `Platform.OS === 'web'`.
- Never use native-only APIs (`Linking.openURL` with native schemes, `NativeModules`) without guarding behind `Platform.OS !== 'web'`.
- Navigation uses `@react-navigation/drawer`. On native, the drawer is swipeable. On web ≥ 900px, navigation is handled by `WebSidebar`; on narrow web, by `BottomTabBar`.
- Screens are wrapped with `withTabs()` in `MainDrawerNavigator.tsx` to inject the web layout shell. New screens must also be wrapped.

---

## Design System: "The Sacred Journal"

All styling tokens live in `apps/mobile/constants/theme.ts`. **Never hard-code colours, fonts, radii, or shadows** — always import from the theme.

### Colours

- Import: `import { colors } from '../constants/theme'`
- Primary palette is **deep berry** (`#7C003A`) with **purple** secondary (`#7D45A2`) and **indigo** tertiary accents.
- Surfaces use **tonal layering** (M3 style) — no 1px borders. Use `surfaceContainer*` tokens for depth.
- Cards use `colors.card` (`#FFFFFF`) with `ambientShadow` (blur 40, spread -5, 4-6% opacity, tinted — never pure black).
- Outline/borders use `colors.outline` at 15% opacity ("ghost border"), never solid lines.

### Typography

- Import: `import { fonts } from '../constants/theme'`
- **Display / headings**: Plus Jakarta Sans (`displayBold`, `displayExtraBold`, etc.)
- **Body / UI text**: Be Vietnam Pro (`bodyRegular`, `bodyMedium`, `bodySemiBold`, etc.)
- Never use system fonts or raw font-family strings.

### Spacing & Radii

- Import: `import { spacing, radii } from '../constants/theme'`
- Spacing: `xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48`
- Radii: `sm: 8, md: 12, lg: 16, xl: 24, full: 9999`

### Shadows

- Import: `import { ambientShadow } from '../constants/theme'`
- Use the `ambientShadow` preset for card/container elevation. Never use `elevation` alone or hard-coded shadow values.

### Gradients

- Navigation drawer/sidebar uses `LinearGradient` with `[colors.primaryContainer, colors.secondary]`.
- Avatar gradients rotate through a palette derived from primary/secondary/tertiary tokens.

### Layout patterns

- Use `StyleSheet.create()` for all styles — no inline style objects except for dynamic values.
- Cards: `backgroundColor: colors.card`, `borderRadius: radii.lg`, spread `...ambientShadow`.
- Inputs: `backgroundColor: colors.surfaceContainerHigh`, `borderRadius: radii.md`.
- Icons: use `@expo/vector-icons` (`Ionicons`) or custom `Image`-based icons (see `ReactionIcons.tsx`).

---

## Server: Multer & Multipart Uploads

When adding file upload support (multer) to an Express route that also accepts JSON bodies, **always guard multer behind a content-type check**. Otherwise multer will attempt to parse JSON requests as multipart and throw "Malformed part header".

```ts
// ✅ Correct — only invoke multer for multipart requests
router.post('/', (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('image')(req, res, next);
  } else {
    next();
  }
}, ...);

// ❌ Wrong — breaks JSON requests
router.post('/', upload.single('image'), ...);
```

## Client: Web Blob URIs Have No File Extension

On web, `expo-image-picker` returns `blob:` URIs (e.g. `blob:http://localhost:8081/...`) which have **no file extension**. Never parse the URI string to determine the file type on web. Instead, fetch the blob and read its `.type` property.

```ts
// ✅ Correct — derive extension from blob mime type
if (Platform.OS === 'web') {
  const blob = await fetch(uri).then((r) => r.blob());
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png' }[blob.type] ?? 'jpg';
  formData.append('image', blob, `photo.${ext}`);
}

// ❌ Wrong — blob URIs have no extension
const ext = uri.split('.').pop(); // returns garbage on web
```
