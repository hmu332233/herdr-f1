# Herdr F1

**An F1-style dashboard for your Herdr agents.**

[한국어](README.KR.md)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-2-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Herdr F1 visualizes the status of your running Herdr agents as an F1 race.

![Herdr F1 dashboard showing Herdr workspaces and coding agents as teams and race cars](assets/herdr-f1-dashboard.gif)

Each `workspace` becomes a team, and each `agent terminal` becomes a race car. Agents
race around the circuit while working, wait in the pits while idle, and stop on the
track when blocked. Select a car or a row in the standings to jump directly to its
Herdr terminal.

Laps, standings, and points are fictional data created for spectating. They do not
measure productivity or agent performance.

## Quick start

Requirements:

- macOS or Linux
- A running [Herdr](https://github.com/ogulcancelik/herdr) 0.7.4 or later
- Node.js 20 or later

Choose either the Herdr plugin or the CLI.

```sh
# Herdr plugin
herdr plugin install hmu332233/herdr-f1
herdr plugin action invoke dev.minung.herdr-f1.open

# CLI
npx herdr-f1 --open
```

### Herdr plugin

Your browser will open, and agents in the current Herdr session will join the race.
To stop the dashboard, run:

```sh
herdr plugin action invoke dev.minung.herdr-f1.stop
```

The plugin includes the server and web assets required to run, so no separate
installation or build is needed.

#### Open with a keyboard shortcut

Add the following to `~/.config/herdr/config.toml` to open the dashboard with
`prefix+f`. The default prefix is `ctrl+b`.

```toml
[[keys.command]]
key = "prefix+f"
type = "plugin_action"
command = "dev.minung.herdr-f1.open"
description = "open F1 dashboard"
```

Apply the updated configuration to the running Herdr session:

```sh
herdr server reload-config
```

### CLI

Run the dashboard directly without installing the Herdr plugin. Omit `--open` to
print the local URL without opening a browser.

```sh
npx herdr-f1 [start] [--port <port>] [--open] [--socket <path>]
npx herdr-f1 status [--socket <path>]
npx herdr-f1 stop [--socket <path>]
```

If installed globally, you can omit `npx`. The default port is `4158`; if it is
already in use, Herdr F1 automatically finds the next available port.

### Multiplayer race modes

Start a host, then have each team run the printed `join` command on a machine
with Herdr. `classic` remains the default. `continuous` keeps idle, completed,
mixed-state, and offline teams circulating at cruising pace; blocked crews stop
and deploy a queue-forming Safety Car.

```sh
npx herdr-f1 host --race-mode classic
npx herdr-f1 host --race-mode continuous
npx herdr-f1 join <host[:port]> --name <team-name>
```

The host owns race mode, venue rotation, scoring, and race control. Viewers can
see those rules but cannot change them. Continuous mode rotates venues with a
shuffle bag, showing every circuit once before reshuffling.

## How it works

| Herdr status | Dashboard |
| --- | --- |
| `working` | Racing on the circuit |
| `idle` | Waiting in the pits |
| `done` | Finished racing |
| `blocked` | Stopped after an incident |

### Team radio

Status changes are announced as pit-wall radio along the bottom of the screen:
a car heading for the pits, an incident, a chequered flag. Select a line to jump
to that agent's Herdr terminal.

Radio lines are invented commentary picked from a fixed script by which status
change occurred, exactly like laps and points. **They are never an agent's
actual output** — the dashboard cannot read what an agent says.

The dashboard reads Herdr session status and only sends a terminal-focus command
when you select a car. It does not collect terminal output or conversation content,
and the server binds only to `127.0.0.1` to prevent external access.

## Troubleshooting

If the plugin does not open, check its installation status and recent logs:

```sh
herdr plugin list --plugin dev.minung.herdr-f1
herdr plugin log list --plugin dev.minung.herdr-f1 --limit 20
```

To check the status and URL of a dashboard started from the CLI, run:

```sh
npx herdr-f1 status
```

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```

To connect a local checkout to Herdr, run:

```sh
herdr plugin link .
```

To recognize a contributor, update `.all-contributorsrc` and regenerate the table:

```sh
npx all-contributors generate
```

Bug reports and pull requests are welcome.

## Contributors ✨

Thanks go to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hmu332233"><img src="https://avatars.githubusercontent.com/hmu332233?v=4?s=100" width="100px;" alt="Minung Han"/><br /><sub><b>Minung Han</b></sub></a><br /><a href="https://github.com/hmu332233/herdr-f1/commits?author=hmu332233" title="Code">💻</a> <a href="https://github.com/hmu332233/herdr-f1/commits?author=hmu332233" title="Documentation">📖</a> <a href="#design-hmu332233" title="Design">🎨</a> <a href="https://github.com/hmu332233/herdr-f1/commits?author=hmu332233" title="Tests">⚠️</a> <a href="#maintenance-hmu332233" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/DevooKim"><img src="https://avatars.githubusercontent.com/DevooKim?v=4?s=100" width="100px;" alt="Kim HyunWoo"/><br /><sub><b>Kim HyunWoo</b></sub></a><br /><a href="https://github.com/hmu332233/herdr-f1/commits?author=DevooKim" title="Code">💻</a> <a href="https://github.com/hmu332233/herdr-f1/commits?author=DevooKim" title="Documentation">📖</a> <a href="https://github.com/hmu332233/herdr-f1/commits?author=DevooKim" title="Tests">⚠️</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [All Contributors](https://allcontributors.org/) specification.
