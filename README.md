# Herdr F1

**Herdr에서 일하는 코딩 에이전트들을 실시간 Grand Prix로 바꾸는 로컬 웹 대시보드입니다.**

명령어 하나를 실행하면 브라우저에 공용 서킷이 열립니다. 각 Herdr workspace는
레이싱 팀이 되고, 감지된 agent terminal은 고유 번호를 가진 차량이 됩니다.
에이전트가 작업을 시작하면 차량이 달리고, 쉬면 피트에 들어가며, 막히면 사고로
표시됩니다. 여러 브라우저 탭을 열어도 모두 같은 레이스를 관전합니다.

이 도구는 에이전트의 성과를 평가하는 분석 도구가 아닙니다. Herdr의 실제 세션
상태를 재미있고 한눈에 보기 쉬운 라이브 장면으로 표현하는 **로컬 관전 도구**입니다.

## 무엇을 보여 주나요?

| Herdr | 레이스 표현 |
| --- | --- |
| workspace | constructor / 팀 |
| agent terminal | 고유 번호를 가진 차량 |
| `working` | 서킷 주행 |
| `idle` | 팀 피트에서 대기 |
| `done` | 점수를 멈추고 쿨다운 |
| `blocked` | 해당 위치에서 사고로 정지 |
| focused terminal | `ONBOARD` 강조 |

마커나 순위표 행을 클릭하거나 Return/Space로 활성화하면 해당 Herdr terminal로
포커스를 이동합니다. 이 동작은 `agent.focus`만 전송하며 에이전트 상태를 임의로
변경하지 않습니다.

## 실제 데이터와 가상 데이터

Herdr `session.snapshot`에서 가져오는 실제 정보:

- workspace와 팀 구성
- workspace / tab 라벨
- agent 종류와 `idle` / `working` / `done` / `blocked` 상태
- 현재 focus

대시보드가 재미를 위해 만드는 가상 정보:

- 랩, 거리, 페이스와 순위
- 팀 점수와 포디엄
- Grand Prix 결과

가상 정보는 CLI 프로세스가 살아 있는 동안만 메모리에 유지됩니다. 생산성,
진행률, 메시지 수 또는 token 사용량을 나타내지 않으며 프로세스를 다시 실행하면
모두 초기화됩니다.

## 빠른 시작

요구 사항:

- Node.js 20 이상
- 실행 중인 Herdr 0.7.4 이상(protocol 16 또는 17)

저장소에서 설치하고 실행합니다.

```sh
npm install
npm run build
npm link
herdr-f1
```

CLI가 `127.0.0.1`에 웹 서버를 열고 기본 브라우저를 자동으로 실행합니다.

```text
Herdr F1 · http://127.0.0.1:4158
Press Ctrl+C to stop.
```

Herdr가 아직 실행 중이 아니어도 CLI는 종료되지 않습니다. 기본 Unix socket을
기다리며 화면에는 `FORMATION LAP · AWAITING GRID`가 표시됩니다.

## 사용법

```text
herdr-f1 [start] [options]
```

```text
--port <n>        시작 포트 지정 (기본 4158, 사용 중이면 다음 포트 탐색)
--no-open         브라우저를 자동으로 열지 않음
--socket <path>   Herdr Unix socket 경로 지정
--fixture <name>  Herdr 없이 디자인 fixture 실행
```

`start`는 이전 호출 방식과의 호환을 위한 선택적 alias입니다.

예시:

```sh
herdr-f1 --no-open --port 4158
herdr-f1 --socket /custom/path/herdr.sock
herdr-f1 --fixture grid
```

사용 가능한 fixture는 `grid`, `dense`, `redflag`, `error`, `podium`입니다.

## 레이스 동작

- 한 Grand Prix는 58랩이며 선두 차량이 완주하면 팀 포디엄을 보여 준 뒤 다음
  레이스가 자동으로 시작됩니다.
- `working` 차량만 공식 거리가 증가합니다. 차량별 페이스는 가상으로 결정됩니다.
- `idle`, `done`, `blocked` 차량의 공식 거리는 증가하지 않습니다.
- 사라진 terminal은 현재 레이스 동안 `RETIRED`로 남고 다음 grid에서 제거됩니다.
- 연결이 끊기면 마지막 상태를 동결하고 `RED FLAG · HERDR OFFLINE`을 표시합니다.
  재연결되면 같은 Grand Prix를 이어 갑니다.
- 한 Grand Prix에는 최대 99대의 차량이 참가할 수 있습니다.

## 구조와 로컬 보안

Node 서버가 Herdr Unix socket에 연결하고 레이스 상태를 소유합니다. 브라우저는
WebSocket으로 같은 상태를 받아 렌더링하는 관전자입니다. 서버는 terminal focus를
제어할 수 있으므로 외부 네트워크에 노출하지 않고 `127.0.0.1`에만 바인딩합니다.
terminal 출력 polling, session log parsing 또는 레이스 기록 저장은 하지 않습니다.

런타임 의존성은 [`ws`](https://www.npmjs.com/package/ws) 하나입니다.

## 개발

```sh
npm test             # 엔진, 프로토콜, 서버, 브라우저 상태 테스트
npm run typecheck    # TypeScript 검사
npm run build        # 웹과 Node 서버 프로덕션 빌드
```

웹과 서버를 따로 실행하며 개발할 수도 있습니다.

```sh
npm run dev:server
npm run dev:web
```

테스트의 fake Herdr는 임시 Unix domain socket을 사용합니다. 제한된 sandbox에서
socket 또는 localhost 바인딩이 금지되어 있으면 `EPERM`이 발생할 수 있습니다.
