# Isolated environment with Node but no FFmpeg — proves missing-FFmpeg recovery
# without touching the host Homebrew install.
FROM node:22-bookworm-slim

WORKDIR /app

# Intentionally do NOT apt-install ffmpeg.
RUN if command -v ffmpeg >/dev/null 2>&1; then echo "ffmpeg must not be present" >&2; exit 1; fi

COPY src ./src
COPY test/ffmpeg.test.js ./test/ffmpeg.test.js
COPY scripts/test-ffmpeg-missing.js ./scripts/test-ffmpeg-missing.js

CMD ["sh", "-c", "node --test test/ffmpeg.test.js && node scripts/test-ffmpeg-missing.js"]
