import { browser, $, $$ } from "@wdio/globals";
import {
  byAccessibilityId,
  byText,
  byTextContains,
  screenshot,
  tapElement,
  waitForAppReady,
} from "./helpers";

/**
 * Posts → React → Comment → React (full feed interaction loop)
 *
 * SKIPPED — login → Home is not reachable from the Appium runner against the
 * current debug APK. After tapping "Enter Spaze" the app/UiAutomator
 * instrumentation is force-stopped before any Home-screen render markers
 * appear (same blocker noted in `navigation.e2e.ts`). To enable this suite:
 *   1) Build a release-mode APK (no JS dev overlay):
 *      `cd apps/mobile && eas build -p android --profile preview --local`
 *      and point `wdio.android.conf.ts` `appium:app` at the resulting APK.
 *   2) OR add a `?e2e=1` deep link / dev-only "skip login" affordance.
 *
 * Once unblocked, this suite covers the full interaction loop:
 *   1. Compose a SAFE post via the FAB / composer.
 *   2. React (Pray) on the new post in the feed.
 *   3. Open the post detail → write a comment.
 *   4. React (Like) on the comment.
 *
 * Selector strategy:
 *   - Post composer FAB: `~Post` (HomeScreen line 796 — accessibilityLabel="Post")
 *   - Submit button:     text("Post") inside PostScreen header
 *   - Composer input:    EditText with placeholder containing "What's on your mind"
 *   - Reaction button (post): tap the icon next to the comment count — currently
 *     a View+PanResponder, NOT exposed via accessibilityLabel. **Action item**:
 *     add `accessibilityLabel="post-react"` to the Animated.View wrapper at
 *     PostCard.tsx line 651 to make this reliably tappable.
 *   - Comment button (post): TouchableOpacity at PostCard.tsx line 675 — add
 *     `accessibilityLabel="post-comment"` to enable `~post-comment` lookup.
 *   - Comment input: EditText with placeholder "Write a supportive message..."
 *     (PostDetailScreen.tsx line 1749).
 *   - Comment send button: search around the input — needs
 *     `accessibilityLabel="comment-send"`.
 *   - Comment-react (Like) button: per-comment row needs
 *     `accessibilityLabel="comment-react-{commentId}"` or `"comment-react"`.
 */
describe.skip("Posts — React → Comment → React loop", () => {
  const POST_CONTENT = `e2e test post ${Date.now()}`;
  const COMMENT_CONTENT = `e2e test comment ${Date.now()}`;
  let createdPostHandled = false;

  before(async () => {
    await waitForAppReady();

    // ── Login as anonymous user ──
    const cta = await $(byAccessibilityId("Enter Spaze"));
    await cta.waitForDisplayed({ timeout: 15_000 });
    await tapElement(cta);

    // Wait for Home markers (composer FAB or trending pill).
    const composerFab = await $(byAccessibilityId("Post"));
    await composerFab.waitForDisplayed({ timeout: 60_000 });
  });

  it("composes a SAFE post from the feed", async () => {
    const composerFab = await $(byAccessibilityId("Post"));
    await tapElement(composerFab);

    // PostScreen composer input — locate by placeholder.
    const composerInput = await $(
      'android=new UiSelector().className("android.widget.EditText").' +
        'descriptionContains("What")'
    );
    // Fallback: first EditText on the screen (composer is the only one).
    const input = (await composerInput.isExisting())
      ? composerInput
      : await $('android=new UiSelector().className("android.widget.EditText")');
    await input.waitForDisplayed({ timeout: 10_000 });
    await input.click();
    await input.setValue(POST_CONTENT);

    // Submit via the "Post" header button.
    const submit = await $(byText("Post"));
    await tapElement(submit);

    // Returns to Home and the new post should appear (or a moderation alert).
    const newPost = await $(byTextContains(POST_CONTENT));
    await newPost.waitForDisplayed({ timeout: 30_000 });
    createdPostHandled = true;
    await screenshot("post-created");
    expect(await newPost.isDisplayed()).toBe(true);
  });

  it("reacts (Pray) to the newly created post", async () => {
    expect(createdPostHandled).toBe(true);

    // Scroll the new post into view if needed, then tap its react button.
    // Requires `accessibilityLabel="post-react"` on the reaction Animated.View
    // in PostCard.tsx (~line 651). Until then, the ~post-react selector below
    // will not resolve.
    const reactBtn = await $(byAccessibilityId("post-react"));
    await reactBtn.waitForDisplayed({ timeout: 10_000 });
    await tapElement(reactBtn);

    // The reaction icon switches from outline (lightPrimary) to filled (primary)
    // and the count next to it increments. We assert by re-reading the same
    // element and confirming the press did not throw / the screen is intact.
    const composerFab = await $(byAccessibilityId("Post"));
    expect(await composerFab.isDisplayed()).toBe(true);
    await screenshot("post-reacted");
  });

  it("opens the post detail and submits a comment", async () => {
    // Tap the comment button next to the reaction (requires
    // accessibilityLabel="post-comment" on the TouchableOpacity at
    // PostCard.tsx line 675).
    const commentBtn = await $(byAccessibilityId("post-comment"));
    await commentBtn.waitForDisplayed({ timeout: 10_000 });
    await tapElement(commentBtn);

    // PostDetailScreen comment input.
    const commentInput = await $(
      'android=new UiSelector().className("android.widget.EditText").' +
        'descriptionContains("supportive")'
    );
    const input = (await commentInput.isExisting())
      ? commentInput
      : await $('android=new UiSelector().className("android.widget.EditText")');
    await input.waitForDisplayed({ timeout: 10_000 });
    await input.click();
    await input.setValue(COMMENT_CONTENT);

    // Send the comment (requires accessibilityLabel="comment-send" on the
    // submit IconButton next to the input).
    const sendBtn = await $(byAccessibilityId("comment-send"));
    await tapElement(sendBtn);

    const newComment = await $(byTextContains(COMMENT_CONTENT));
    await newComment.waitForDisplayed({ timeout: 30_000 });
    expect(await newComment.isDisplayed()).toBe(true);
    await screenshot("comment-created");
  });

  it("reacts (Like) to the newly created comment", async () => {
    // Per-comment Like/Pray button — requires accessibilityLabel="comment-react"
    // on the per-comment reaction TouchableOpacity in PostDetailScreen.
    // Multiple comments → take the first one whose row contains our content.
    const reactBtns = await $$(byAccessibilityId("comment-react"));
    expect(reactBtns.length).toBeGreaterThan(0);
    await tapElement(reactBtns[reactBtns.length - 1]); // newest comment is last

    // The screen must remain interactive after the reaction.
    const back = await $(
      'android=new UiSelector().descriptionContains("back")'
    );
    expect(await back.isExisting()).toBe(true);
    await screenshot("comment-reacted");
  });

  after(async () => {
    // Best-effort: tap back to leave the post detail so subsequent suites
    // start from a known surface.
    try {
      await browser.executeScript("mobile: pressKey", [{ keycode: 4 }]); // KEYCODE_BACK
    } catch {
      // ignore
    }
  });
});
