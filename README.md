# Discord Quest Completer

Fast and optimized Discord quest completion script that automatically completes various Discord quest types.

## Features

- **WATCH_VIDEO** / **WATCH_VIDEO_ON_MOBILE**: Completes video watching quests at 30x speed
- **PLAY_ON_DESKTOP**: Simulates game running for desktop play quests
- **STREAM_ON_DESKTOP**: Simulates streaming for stream quests
- **PLAY_ACTIVITY**: Completes voice activity quests

## Optimizations

- 30x video speed (up from 15x)
- 200ms update intervals (down from 500ms)
- Faster retry logic with reduced delays
- 3s heartbeat intervals for PLAY_ACTIVITY (down from 7s)
- Optimized API call retry mechanism

## Usage

1. Open Discord in your browser
2. Open the browser console (F12)
3. Paste the entire contents of `quest-completer-fast.js` into the console
4. Press Enter

The script will automatically:
- Find all uncompleted quests
- Complete them in parallel
- Handle all quest types automatically

## Requirements

- Discord web app or desktop app
- Browser console access
- Active Discord session

## Notes

- The script filters out a specific quest ID (`1412491570820812933`)
- Only processes quests that are enrolled and not yet completed
- Only processes quests that haven't expired
- Desktop-only quests (PLAY_ON_DESKTOP, STREAM_ON_DESKTOP) require the Discord desktop app

## Disclaimer

This script is for educational purposes only. Use at your own risk.

