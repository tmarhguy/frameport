# Other video sources

FramePort does not need to be limited to HDMI capture cards. The source picker can also show cameras and screen sources exposed by macOS.

![Available sources in FramePort](../images/source-picker.png)

*USB video, built-in and iPhone cameras, a screen source, and the test pattern. The list depends on the connected devices and what macOS exposes.*

One workflow I would like to explore is viewing my iPhone or iPad screen beside my code instead of relying only on a simulator. A phone appearing as a camera source is not the same thing as screen mirroring, so that needs its own investigation before I can claim support.

I have also thought about sending a view back to the iPhone or iPad. That would need a receiving application or a supported streaming protocol and would introduce a different set of problems. For now, I am keeping the direction simple: sources come into FramePort for viewing and capture.

The immediate job is to make the existing sources reliable. Mobile mirroring can wait until there is a tested path that fits the same workflow.
