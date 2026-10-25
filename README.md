# Steam Player Count Badge
Show live Steam player counts in the game details stats row (next to Play Time and Achievements) in Steam Desktop mode, similar to [playcount-decky](https://github.com/itsOwen/playcount-decky) which unfortunately only works in Big Picture mode.
Click the badge to open the game's charts page on [SteamDB](https://steamdb.info/).

![Badge Example](images/screenshot.png)

## Features
- Live player count from Valve's public Steam Web API (no API key required)
- Refreshes while a game is selected (every 30 seconds by default)
- Badge styling matches Steam's native stats tiles
- Configurable badge colors: Default, Gradient, Rarity, Single color, No colors, or fully custom per-tier colors picked in the plugin settings
- Configurable refresh interval: 30 seconds, 1 minute, 2 minutes, or 5 minutes
- Click badge to open SteamDB charts in your system browser

## Requirements
- [Millennium](https://github.com/SteamClientHomebrew/Millennium)

## Installation
1. Download the prebuilt release from [Releases](https://github.com/swindlesmccoop/playercount-badge/releases); do not download the source code zip, download the actual release.
2. Unzip the folder into `~/.local/share/millennium/plugins/` (make sure it doesn't become nested and look like `playercount-badge/playercount-badge/[repo]`)
3. Restart Steam, enable the plugin, click Save, and restart Steam again.

## Manual Installation/Building
Requires docker for building.
```bash
git clone https://github.com/swindlesmccoop/playercount-badge
cd playercount-badge
./scripts/build.sh
ln -s $PWD $HOME/.local/share/millennium/plugins/
```

## Notes
Most of this plugin was written with Composer 2.5 as I don't work with TypeScript, but nobody had made this plugin yet. It works, which is all that I care about.
Data is sourced from
```text
https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid={APPID}
```
