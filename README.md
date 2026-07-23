# Herdr F1

Herdr에서 실행 중인 코딩 에이전트를 F1 레이스로 보여 주는 로컬 웹 대시보드입니다.

![Herdr workspace와 코딩 에이전트를 팀과 차량으로 보여 주는 Herdr F1 대시보드](docs/images/herdr-f1-dashboard.gif)

Herdr의 `workspace`는 팀으로, `agent terminal`은 차량으로 표현됩니다. 에이전트가 작업
중이면 달리고, 쉬면 피트에 머물며, 막히면 서킷 위에 멈춥니다. 차량이나 순위표를
선택하면 해당 Herdr 터미널로 바로 이동할 수 있습니다.

랩, 순위, 점수는 관전을 위해 만든 가상 데이터입니다. 생산성이나 에이전트 성능을
측정하지 않습니다.

## 빠른 시작

요구 사항:

- macOS 또는 Linux
- 실행 중인 [Herdr](https://github.com/ogulcancelik/herdr) 0.7.4 이상
- Node.js 20 이상

Herdr F1 플러그인을 설치합니다.

```sh
herdr plugin install hmu332233/herdr-f1
```

Herdr F1을 엽니다.

```sh
herdr plugin action invoke dev.minung.herdr-f1.open
```

브라우저가 열리고 현재 Herdr 세션의 에이전트가 레이스에 합류합니다. 대시보드를
종료하려면 다음 액션을 실행합니다.

```sh
herdr plugin action invoke dev.minung.herdr-f1.stop
```

플러그인에는 실행에 필요한 서버와 웹 파일이 포함되어 있어 별도의 설치나 빌드가
필요하지 않습니다.

### 단축키로 열기

`~/.config/herdr/config.toml`에 다음 설정을 추가하면 `prefix+f`로 대시보드를 열 수
있습니다. 기본 prefix는 `ctrl+b`입니다.

```toml
[[keys.command]]
key = "prefix+f"
type = "plugin_action"
command = "dev.minung.herdr-f1.open"
description = "open F1 dashboard"
```

설정을 추가한 뒤 실행 중인 Herdr에 반영합니다.

```sh
herdr server reload-config
```

## CLI

Herdr 플러그인을 설치하지 않고 CLI로 대시보드를 실행할 수도 있습니다. 이 경우에도
Herdr 세션은 실행 중이어야 합니다.

```sh
npx herdr-f1 --open
```

`--open`을 빼면 브라우저를 열지 않고 접속할 로컬 URL만 출력합니다.

```sh
npx herdr-f1 [start] [--port <port>] [--open] [--socket <path>]
npx herdr-f1 status [--socket <path>]
npx herdr-f1 stop [--socket <path>]
```

전역 설치한 경우에는 명령 앞의 `npx`를 생략할 수 있습니다. 기본 포트는 `4158`이며,
이미 사용 중이면 다음 포트를 자동으로 찾습니다.

## 동작 방식

| Herdr 상태 | 대시보드 |
| --- | --- |
| `working` | 서킷 주행 |
| `idle` | 피트 대기 |
| `done` | 주행 종료 |
| `blocked` | 사고로 정지 |

대시보드는 Herdr의 세션 상태를 사용하고, 차량을 선택할 때 터미널 포커스 명령만
보냅니다. 터미널 출력이나 대화 내용은 수집하지 않으며 서버는 외부에 노출되지 않도록
`127.0.0.1`에서만 실행됩니다.

## 문제 해결

플러그인이 열리지 않으면 설치 상태와 최근 실행 로그를 확인합니다.

```sh
herdr plugin list --plugin dev.minung.herdr-f1
herdr plugin log list --plugin dev.minung.herdr-f1 --limit 20
```

CLI로 실행한 대시보드의 상태와 URL은 다음 명령으로 확인할 수 있습니다.

```sh
npx herdr-f1 status
```

## 개발

```sh
npm install
npm test
npm run typecheck
npm run build
```

로컬 checkout을 Herdr에 연결하려면 다음 명령을 실행합니다.

```sh
herdr plugin link .
```

버그 리포트와 pull request를 환영합니다.
