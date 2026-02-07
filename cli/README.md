# ⚛️ React Debugger

Advanced debugging & performance optimization tool for ReactJS applications.

## Quick Install

```bash
npx react-debugger
```

This will download the Chrome extension to your local machine.

## Usage

### Interactive Mode

```bash
npx react-debugger
```

Follow the prompts to choose installation directory.

### Direct Install

```bash
npx react-debugger ./my-extension
```

### Options

```
-v, --version    Show version number
-h, --help       Show help
```

## Loading the Extension in Chrome

After installation:

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the folder where you installed the extension

## Features

- 🎯 **UI & State Issues** - Detect direct state mutation, missing keys, index as key
- ⚡ **Performance Analysis** - Track re-renders, identify excessive renders
- 🔄 **Side Effects** - Find missing cleanup, dependency issues in useEffect
- 📐 **CLS Monitor** - Track Cumulative Layout Shift in real-time
- 🗄️ **Redux DevTools** - View state tree, dispatch actions manually
- 📊 **Timeline** - Visual timeline of all React events
- 💾 **Memory** - Monitor memory usage and detect leaks

## Requirements

- Node.js >= 18.0.0
- Chrome, Brave, or any Chromium-based browser

## Links

- [GitHub Repository](https://github.com/nhonh/react-debugger-extension)
- [Report Issues](https://github.com/nhonh/react-debugger-extension/issues)

## License

MIT © NhoNH
