const { existsSync } = require('node:fs');

const HOMEBREW_FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
const HOMEBREW_BREW = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
const GUIDE_URL = 'https://ffmpeg.org/download.html';
const BREW_URL = 'https://brew.sh';

function resolveFfmpegPath(configured = 'ffmpeg', platform = process.platform, exists = existsSync) {
  if (configured && configured !== 'ffmpeg') return configured;
  if (platform === 'darwin') {
    for (const path of HOMEBREW_FFMPEG) if (exists(path)) return path;
  }
  return configured || 'ffmpeg';
}

function isMissingFFmpegError(error) {
  if (!error) return false;
  const code = error.code || error.errno;
  if (code === 'ENOENT') return true;
  const text = typeof error === 'string' ? error : (error.message || String(error));
  if (!text) return false;
  return /\bENOENT\b/i.test(text)
    || /Could not launch FFmpeg/i.test(text)
    || /spawn\s+\S+\s+ENOENT/i.test(text)
    || /not found/i.test(text) && /ffmpeg/i.test(text);
}

function helpButtons(platform = process.platform) {
  const buttons = [];
  if (platform === 'darwin') buttons.push('Install via Homebrew');
  buttons.push('Install guide', 'Open Settings');
  return buttons;
}

function brewPath(exists = existsSync) {
  for (const path of HOMEBREW_BREW) if (exists(path)) return path;
  return undefined;
}

async function installViaHomebrew(api, exists = existsSync) {
  const confirmed = await api.window.showWarningMessage(
    'FramePort will open a Terminal and run brew install ffmpeg. Continue?',
    { modal: true },
    'Install'
  );
  if (confirmed !== 'Install') return;
  if (!brewPath(exists)) {
    await api.window.showInformationMessage('Homebrew was not found. Install Homebrew first, then install FFmpeg.');
    await api.env.openExternal(api.Uri.parse(BREW_URL));
    return;
  }
  const terminal = api.window.createTerminal({ name: 'FramePort · FFmpeg' });
  terminal.show(true);
  terminal.sendText('brew install ffmpeg', true);
}

async function offerFFmpegHelp(api, {
  detail = 'FFmpeg was not found. FramePort needs it for capture and recording.',
  platform = process.platform,
  exists = existsSync
} = {}) {
  const message = platform === 'darwin'
    ? `${detail} On macOS, Homebrew is the usual install path.`
    : `${detail} Install FFmpeg, then set frameport.ffmpegPath if it is not on PATH.`;
  const choice = await api.window.showErrorMessage(`FramePort: ${message}`, ...helpButtons(platform));
  if (choice === 'Install via Homebrew') await installViaHomebrew(api, exists);
  else if (choice === 'Install guide') await api.env.openExternal(api.Uri.parse(GUIDE_URL));
  else if (choice === 'Open Settings') await api.commands.executeCommand('workbench.action.openSettings', '@id:frameport.ffmpegPath');
  return choice;
}

async function reportFFmpegProblem(api, error, fallbackMessage) {
  if (isMissingFFmpegError(error)) {
    const detail = typeof error === 'string' ? error : (error?.message || fallbackMessage);
    return offerFFmpegHelp(api, { detail: detail || fallbackMessage });
  }
  const text = typeof error === 'string' ? error : (error?.message || fallbackMessage || 'Unexpected FFmpeg error.');
  return api.window.showErrorMessage(`FramePort: ${text}`);
}

module.exports = {
  resolveFfmpegPath,
  isMissingFFmpegError,
  helpButtons,
  brewPath,
  installViaHomebrew,
  offerFFmpegHelp,
  reportFFmpegProblem,
  GUIDE_URL,
  BREW_URL
};
