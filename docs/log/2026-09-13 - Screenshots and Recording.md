# Screenshots and recording

The features I care about most, after the live view, are screenshots and recordings of the FPGA output.

I want as little friction as possible between noticing something and saving it. A screenshot is useful for a display bug or a new screen layout. A short recording captures behavior that a still image cannot: a menu transition, a game, or a problem that appears only briefly.

FramePort now saves the displayed frame as PNG and records the active source as a silent MP4. Pausing the preview lets me inspect a frame; it does not pause recording. That distinction matters when I want to study one image without losing what happens next.

![Recording indicator in FramePort focus mode](../images/focus-recording.png)

*Focus mode with the recording badge, captured from the synthetic test-pattern harness with an injected recording state — not a hardware recording.*

The next concern is responsiveness. Saving a clip should not make the live view unpleasant to use. The recorder shares the existing capture feed and skips frames under load rather than building an ever-growing queue. I still want to judge that behavior on the real hardware, not just by whether a test passes.

The aim is to keep the related steps together: view, inspect, save, and find the saved file. More features can follow when there is a clear need for them.
