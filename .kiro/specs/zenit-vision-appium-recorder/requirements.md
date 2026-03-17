# Requirements Document

## Introduction

Zenit Vision is a device inspection and test automation recording tool embedded in the Zenit QA platform. This feature upgrade transforms Zenit Vision from a mock-data prototype into a fully functional, production-ready tool that:

- Streams a real Android device screen live via ADB
- Captures every user interaction (tap, swipe, type, scroll, long press, double tap, device buttons) along with the element locators resolved from the live UI hierarchy at the exact interaction coordinates
- Records all actions into a structured action list while recording is active
- Generates complete, immediately runnable Appium test scripts in Python, Java, and JavaScript/WebdriverIO — including imports, driver setup, capabilities, explicit waits, every recorded step, and teardown
- Executes those generated scripts (or manually written Appium scripts) on the connected device via a backend subprocess runner, streaming real-time stdout/stderr back to the UI

The frontend is Next.js 14 / TypeScript / Tailwind CSS with a hardcoded VS Code–style light theme (`#F3F3F3`, `#0078D4`). The backend is Python FastAPI with a WebSocket server on port 8767 and a REST API on port 8000.

---

## Glossary

- **ADB**: Android Debug Bridge — command-line tool for communicating with Android devices over USB or TCP.
- **ADB_Bridge**: The backend subsystem responsible for executing ADB shell commands and capturing screenshots and UI hierarchy from a real Android device.
- **Vision_Server**: The FastAPI + WebSocket backend server running on port 8767 that manages device connections, screen streaming, hierarchy resolution, and script execution.
- **Vision_UI**: The Next.js frontend page at `/dashboard/vision` that renders the live screen, element tree, recorder, script editor, and runner.
- **Screen_Streamer**: The backend component that continuously captures screenshots from the connected device and pushes them to the Vision_UI over WebSocket.
- **Hierarchy_Resolver**: The backend component that fetches the live UI hierarchy from the device (via `adb shell uiautomator dump` or Appium's `getPageSource`) and parses it into a normalized element tree.
- **Element_Locator**: A set of attributes used to identify a UI element: `resourceId`, `accessibilityId` (content-desc), `text`, `className`, and `xpath`.
- **Locator_Priority**: The preferred order for selecting the best locator: `resourceId` > `accessibilityId` > `text` > `xpath`.
- **Action_Recorder**: The frontend subsystem that captures user interactions and their resolved Element_Locators into a structured action list.
- **IAM**: Intermediate Action Model — the structured in-memory representation of a recorded action (defined in `src/types/vision.ts` as `VisionAction`).
- **Script_Generator**: The frontend component that converts the IAM action list into a complete, runnable Appium script in the selected language.
- **Script_Runner**: The backend component that receives an Appium script, writes it to a temp file, spawns a subprocess to execute it, and streams stdout/stderr back to the Vision_UI over WebSocket.
- **DSL_Runner**: The existing backend runner that executes simple ADB DSL commands line-by-line (retained for backward compatibility).
- **Ratio_Coordinate**: A normalized (0.0–1.0) x/y coordinate relative to the device screen dimensions, used to translate between screen pixel positions and UI element bounds.
- **UDID**: Unique Device Identifier — the ADB serial number of the connected Android device.
- **AppPackage**: The Android application package name of the app currently in the foreground (e.g., `com.suntv.sunnxt`).

---

## Requirements

### Requirement 1: Real ADB Device Connection

**User Story:** As a QA engineer, I want to connect a real Android device via USB ADB so that I can inspect and interact with the actual app running on the device.

#### Acceptance Criteria

1. WHEN the Vision_Server starts, THE ADB_Bridge SHALL execute `adb devices` to enumerate all connected Android devices and return their serial numbers and model names.
2. WHEN a device is connected via USB and ADB is authorized, THE Vision_Server SHALL detect the device within 3 seconds of the WebSocket client connecting.
3. THE Vision_Server SHALL send a `device_status` WebSocket message with `connected: true`, `id` (UDID), and `model` (device model name) when a real device is detected.
4. IF no ADB-authorized device is found, THEN THE Vision_Server SHALL send a `device_status` message with `connected: false` and a descriptive `reason` field.
5. WHEN the device is disconnected while the WebSocket session is active, THE Vision_Server SHALL send a `device_status` message with `connected: false` within 5 seconds of disconnection.
6. THE ADB_Bridge SHALL resolve the foreground app package name using `adb shell dumpsys window windows` and include it in the `state` WebSocket message as `currentPackage`.

---

### Requirement 2: Live Screen Streaming

**User Story:** As a QA engineer, I want to see the device screen streaming live inside the Zenit UI so that I can observe the app state in real time while interacting with it.

#### Acceptance Criteria

1. WHILE a device is connected, THE Screen_Streamer SHALL continuously capture screenshots using `adb exec-out screencap -p` and push each frame to the Vision_UI as a binary WebSocket message (PNG bytes prefixed with a 4-byte length header) or as a `frame` JSON message with a base64-encoded PNG.
2. THE Screen_Streamer SHALL target a minimum frame rate of 5 frames per second under normal USB ADB conditions.
3. WHEN an action is performed on the device, THE Screen_Streamer SHALL capture and push a fresh screenshot within 800 milliseconds of the action completing, and SHALL include `afterAction: true` in the message to allow the Vision_UI to clear its syncing state.
4. THE Vision_UI SHALL display the streamed frames in the screen viewport, maintaining the device's native aspect ratio without distortion.
5. THE Vision_UI SHALL display the current frames-per-second count in the toolbar, updated every second.
6. IF the ADB screenshot command fails, THEN THE Screen_Streamer SHALL log the error and retry after 500 milliseconds without crashing the WebSocket session.

---

### Requirement 3: Live UI Hierarchy Capture

**User Story:** As a QA engineer, I want the element hierarchy to reflect the real app UI so that I can inspect actual elements and capture accurate locators.

#### Acceptance Criteria

1. WHEN a device connects, THE Hierarchy_Resolver SHALL fetch the UI hierarchy using `adb shell uiautomator dump /sdcard/window_dump.xml && adb pull /sdcard/window_dump.xml` and parse the resulting XML into the normalized element tree format used by the Vision_UI.
2. WHEN the Vision_UI sends a `refresh_hierarchy` WebSocket message, THE Hierarchy_Resolver SHALL re-fetch and re-parse the hierarchy and send a `state` message containing the updated `hierarchy` object within 3 seconds.
3. WHEN an action is performed on the device, THE Hierarchy_Resolver SHALL automatically refresh the hierarchy after the screen settles (500 milliseconds post-action) and push the updated `state` message.
4. THE Hierarchy_Resolver SHALL normalize each element node to include: `id`, `type` (class name short form), `name` (content-desc or text), `attributes` object containing `resourceId`, `contentDesc`, `text`, `bounds` (normalized 0.0–1.0 ratio coordinates), `clickable`, `enabled`, `scrollable`, and `children` array.
5. THE Hierarchy_Resolver SHALL convert raw pixel bounds from the XML (`[x1,y1][x2,y2]` format) into normalized ratio bounds `{ x, y, width, height }` using the device's screen resolution.
6. IF the `uiautomator dump` command fails or times out after 5 seconds, THEN THE Hierarchy_Resolver SHALL send the last known hierarchy and include a `stale: true` flag in the `state` message.

---

### Requirement 4: Element Locator Resolution at Interaction Point

**User Story:** As a QA engineer, I want every interaction I perform on the screen to automatically capture the element locators at that exact position so that I don't have to manually identify elements.

#### Acceptance Criteria

1. WHEN the Vision_UI sends a `tap` action with `ratioX` and `ratioY`, THE Hierarchy_Resolver SHALL find the deepest element in the current hierarchy whose normalized bounds contain the given ratio coordinates.
2. THE Hierarchy_Resolver SHALL return all available locators for the matched element: `resourceId`, `accessibilityId` (content-desc), `text`, `className`, and a generated `xpath`.
3. THE Vision_Server SHALL include the resolved locators in the `action_done` WebSocket response message so the Vision_UI can attach them to the recorded IAM action.
4. THE Script_Generator SHALL select the best locator for each action following Locator_Priority: `resourceId` first, then `accessibilityId`, then `text`, then `xpath`.
5. WHEN no element is found at the given ratio coordinates, THE Hierarchy_Resolver SHALL return an empty locator object and the Vision_UI SHALL record the action with a coordinate-based fallback locator using `driver.tap()` with absolute pixel coordinates.
6. THE generated `xpath` SHALL follow the pattern `//{ClassName}[@resource-id='{resourceId}']` when a resourceId is present, or `//{ClassName}[@content-desc='{contentDesc}']` when only content-desc is present, or `//{ClassName}[@text='{text}']` when only text is present.

---

### Requirement 5: Action Recording

**User Story:** As a QA engineer, I want to record all my interactions with the device into a structured action list so that I can review them and generate a test script.

#### Acceptance Criteria

1. WHEN the user activates the Record button, THE Action_Recorder SHALL set recording state to active and begin capturing all subsequent interactions.
2. WHILE recording is active, THE Action_Recorder SHALL capture the following interaction types into IAM actions: `CLICK` (tap), `SWIPE` (directional swipe), `TYPE` (keyboard input), `LONG_PRESS`, `DOUBLE_TAP`, `SCROLL_UP`, `SCROLL_DOWN`, `HOME` (device home button), `BACK` (device back button), and `WAIT` (explicit pause).
3. WHEN an interaction is captured, THE Action_Recorder SHALL store the resolved Element_Locator, the interaction type, any input value (for TYPE actions), a human-readable description, and a timestamp in the IAM action object.
4. THE Vision_UI SHALL display each captured action in the Recorder tab as a row showing: action type icon, human-readable description, and the best available locator value (following Locator_Priority), updated in real time as actions are recorded.
5. WHEN the user deactivates the Record button, THE Action_Recorder SHALL stop capturing interactions and retain the existing action list.
6. THE Action_Recorder SHALL allow the user to delete individual actions from the list by clicking a delete icon on each action row.
7. THE Action_Recorder SHALL allow the user to clear all recorded actions via a "Clear All" button.

---

### Requirement 6: Complete Appium Script Generation

**User Story:** As a QA engineer, I want to generate a complete, immediately runnable Appium test script from my recorded actions so that I can copy-paste it and run it without any manual editing.

#### Acceptance Criteria

1. WHEN the user clicks "Generate Script", THE Script_Generator SHALL produce a complete script in the selected language (Python, Java, or JavaScript/WebdriverIO) that includes: all required import statements, driver instantiation, capabilities configuration (platformName, automationName, udid, appPackage, noReset), a WebDriverWait instance, all recorded steps with explicit waits, and a `driver.quit()` teardown call.
2. THE Script_Generator SHALL use the connected device's UDID and detected AppPackage in the generated capabilities block, falling back to placeholder strings `YOUR_DEVICE_UDID` and `com.your.app` when not available.
3. THE Script_Generator SHALL generate correct Appium code for ALL recorded action types:
   - `CLICK`: `wait.until(EC.presence_of_element_located(...)).click()` (Python) / `.click()` (Java/JS)
   - `TYPE`: `.send_keys(value)` (Python) / `.sendKeys(value)` (Java) / `.setValue(value)` (JS)
   - `SWIPE`: `driver.swipe(startX, startY, endX, endY, duration)` using absolute pixel coordinates derived from ratio coordinates and device resolution
   - `SCROLL_UP` / `SCROLL_DOWN`: `driver.execute_script("mobile: scroll", {...})` (Python) or equivalent
   - `LONG_PRESS`: `ActionChains` / `TouchAction` long press at element or coordinates
   - `DOUBLE_TAP`: `ActionChains` / `TouchAction` double tap at element or coordinates
   - `HOME`: `driver.press_keycode(3)` (Python/Java) / `driver.pressKeyCode(3)` (JS)
   - `BACK`: `driver.press_keycode(4)` (Python/Java) / `driver.pressKeyCode(4)` (JS)
   - `WAIT`: `time.sleep(seconds)` (Python) / `Thread.sleep(ms)` (Java) / `await driver.pause(ms)` (JS)
4. THE Script_Generator SHALL add a `# Step N: {description}` comment before each generated step.
5. THE Script_Generator SHALL wrap the entire script body in a try/finally block that ensures `driver.quit()` is always called.
6. WHEN the generated script is displayed, THE Vision_UI SHALL auto-populate the Script tab and switch to it, and SHALL provide a one-click "Copy to Clipboard" button.
7. THE Script_Generator SHALL re-generate the script automatically whenever a new action is added to the action list while the Script tab is active.

---

### Requirement 7: Appium Script Execution

**User Story:** As a QA engineer, I want to run the generated Appium script directly from the Zenit UI so that I can verify my recorded test case on the device without leaving the tool.

#### Acceptance Criteria

1. WHEN the Vision_UI sends a `run_appium_script` WebSocket message containing the script source code and language, THE Script_Runner SHALL write the script to a temporary file and spawn a subprocess to execute it using the appropriate interpreter (`python3` for Python, `node` for JavaScript).
2. THE Script_Runner SHALL stream every line of stdout and stderr from the subprocess back to the Vision_UI as `log` WebSocket messages with `level` set to `info` for stdout and `error` for stderr, in real time as lines are produced.
3. WHEN the subprocess exits with code 0, THE Script_Runner SHALL send a `log` message with `level: "success"` and message `"Script completed successfully"`.
4. WHEN the subprocess exits with a non-zero code, THE Script_Runner SHALL send a `log` message with `level: "error"` and message `"Script failed with exit code {code}"`.
5. THE Vision_UI Runner tab SHALL display all streamed log lines in a scrollable terminal-style panel with color coding: white for info, red for error, green for success.
6. THE Vision_UI SHALL provide a "Stop" button that sends a `stop_script` WebSocket message, causing THE Script_Runner to terminate the running subprocess.
7. THE Script_Runner SHALL enforce a maximum execution timeout of 300 seconds, after which it SHALL terminate the subprocess and send a `log` message with `level: "error"` and message `"Execution timed out after 300 seconds"`.
8. THE Vision_UI runner SHALL support both "Auto" mode (runs the generated script from the Script tab) and "Manual" mode (allows the user to paste and run any Appium script).
9. WHEN the runner is in Manual mode and the user pastes a script containing `driver.` or `import ` statements, THE Vision_UI SHALL accept and execute it as an Appium script (removing the existing guard that rejects such scripts).

---

### Requirement 8: ADB DSL Runner (Backward Compatibility)

**User Story:** As a QA engineer, I want to continue running simple ADB DSL commands in the runner so that existing workflows are not broken.

#### Acceptance Criteria

1. THE Vision_UI SHALL retain the existing DSL_Runner mode that sends `run_manual_script` WebSocket messages containing an array of DSL command lines.
2. THE DSL_Runner SHALL support the existing command vocabulary: `tap x y`, `type text`, `swipe x1 y1 x2 y2`, `home`, `back`, `wait seconds`, `screenshot`.
3. WHEN the runner is in DSL mode, THE Vision_UI SHALL display a label indicating "ADB DSL Mode" to distinguish it from Appium Script mode.

---

### Requirement 9: Action Type Coverage in IAM

**User Story:** As a QA engineer, I want all interaction types to be correctly represented in the IAM so that the generated script faithfully reproduces every recorded step.

#### Acceptance Criteria

1. THE IAM `VisionAction` type SHALL be extended to include the following `ActionType` values in addition to the existing ones: `DOUBLE_TAP`, `SCROLL_UP`, `SCROLL_DOWN`, `HOME`, `BACK`, `WAIT`.
2. WHEN a swipe gesture is recorded, THE Action_Recorder SHALL classify it as `SCROLL_UP`, `SCROLL_DOWN`, `SWIPE_LEFT`, or `SWIPE_RIGHT` based on the dominant axis and direction of the gesture vector.
3. WHEN a `SWIPE` action is recorded, THE Action_Recorder SHALL store the start and end ratio coordinates in the `metadata` field as `{ ratioX1, ratioY1, ratioX2, ratioY2 }` so the Script_Generator can produce accurate swipe coordinates.
4. WHEN a `WAIT` action is added manually by the user, THE Action_Recorder SHALL store the wait duration in seconds in the `value` field.

---

### Requirement 10: Locator Quality and Stability

**User Story:** As a QA engineer, I want the captured locators to be as stable as possible so that the generated scripts are reliable across app versions.

#### Acceptance Criteria

1. THE Hierarchy_Resolver SHALL prefer `resourceId` as the primary locator when it is non-empty and does not contain only `android:id/` system IDs.
2. WHEN `resourceId` is absent or is a generic system ID, THE Hierarchy_Resolver SHALL prefer `accessibilityId` (content-desc) as the locator.
3. WHEN both `resourceId` and `accessibilityId` are absent, THE Hierarchy_Resolver SHALL use `text` as the locator if the element's text is non-empty and fewer than 50 characters.
4. WHEN no stable locator is available, THE Hierarchy_Resolver SHALL generate an `xpath` using the element's class name and index within its parent as a fallback.
5. THE Vision_UI element inspector panel SHALL display all available locators for the selected element, with the best locator (per Locator_Priority) highlighted.

---

### Requirement 11: Script Tab Live Preview

**User Story:** As a QA engineer, I want the Script tab to show a live preview of the generated script that updates as I record actions so that I can verify the output in real time.

#### Acceptance Criteria

1. WHILE the Script tab is active and recording is in progress, THE Script_Generator SHALL regenerate the script after each new action is appended to the action list.
2. THE Vision_UI Script tab SHALL display the generated script in a read-only syntax-highlighted code block.
3. THE Vision_UI Script tab SHALL provide a language selector (Python / Java / JavaScript) that triggers immediate regeneration of the script in the selected language.
4. THE Vision_UI Script tab SHALL provide a "Copy" button that copies the full script text to the clipboard and shows a brief confirmation toast.
5. THE Vision_UI Script tab SHALL provide a "Run in Runner" button that copies the script to the Runner tab and switches to it.

---

### Requirement 12: Save and Export Recordings

**User Story:** As a QA engineer, I want to save my recorded actions locally and export them so that I can reuse them later or share them with teammates.

#### Acceptance Criteria

1. WHEN the user clicks "Save Recording", THE Vision_UI SHALL prompt for a recording name and send a `save_local_recording` WebSocket message containing the name and the full IAM action list.
2. WHEN THE Vision_Server receives a `save_local_recording` message, THE Vision_Server SHALL write the action list as a JSON file to a `recordings/` directory relative to the server working directory and send a `recording_saved` message with the file path.
3. THE Vision_UI SHALL provide a "Download JSON" button that serializes the current action list to a JSON file and triggers a browser download without requiring a server round-trip.
4. THE Vision_UI SHALL provide a "Sync to Test Case" button that, when a test case is selected in the toolbar dropdowns, sends the recorded actions to the REST API (`PUT /api/test-cases/{id}`) to update the test case steps.

---

### Requirement 13: UI Layout and Interaction Fidelity

**User Story:** As a QA engineer, I want the Zenit Vision UI to be responsive and accurate so that my interactions on the screen mirror exactly what happens on the device.

#### Acceptance Criteria

1. THE Vision_UI SHALL maintain the existing full-screen layout with no app header, using the hardcoded light theme colors `#F3F3F3` (background) and `#0078D4` (accent).
2. THE Vision_UI SHALL display a tap ripple animation at the exact pixel position of each tap interaction on the screen viewport.
3. THE Vision_UI SHALL display a drag line overlay while a swipe gesture is in progress (mouse down to mouse up).
4. THE Vision_UI SHALL display a context menu on right-click of the screen viewport with options: "Long Press", "Double Tap", and "Inspect Element".
5. THE Vision_UI SHALL display a floating keyboard input bar when the user begins typing, allowing text to be sent to the device via the `type` action.
6. THE Vision_UI SHALL display an action feedback toast in the top-right of the screen viewport for 1.2 seconds after each interaction, showing the action type and coordinates.
7. THE Vision_UI SHALL show a "Syncing…" indicator in the toolbar while waiting for the device to respond to an action, and SHALL clear it when the `action_done` or `afterAction: true` frame message is received.

