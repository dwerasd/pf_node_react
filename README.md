# pf_node_react

## 한 줄 소개
Node.js/Express + TypeScript 백엔드(`node-ts`)와 React + TypeScript 프론트엔드(`react-ts`)로 구성된 개인 포트폴리오/유틸리티 웹 애플리케이션. 주식 분석 도구와 계산기류 페이지를 제공한다.

## 주요 기능

### 백엔드 (`node-ts`)
- Express 기반 REST API 서버: 인증(`/api/auth`), 파일 업로드·다운로드(`/api/files`), 관리자(`/api/admin`), 주식 분석(`/api`) 라우트 제공
- JWT 기반 인증(`jsonwebtoken`, `bcryptjs`)과 MariaDB/MySQL 연동(`mysql2`)
- ZeroMQ 브릿지(`zeromq`)를 통한 실시간 클라이언트 연결 상태 관리 및 브로드캐스트(`/api/zmq/status`, `/api/zmq/test`)
- `helmet`, `express-rate-limit`로 보안 헤더·요청 제한(일반/로그인/업로드별 차등 적용) 적용
- `talib-binding`(옵셔널) 기반 주식 지표 분석 모듈(`stockAnalysis/indicators`, `services`)
- `../../solid-ts/dist` 경로의 정적 파일을 서빙하는 SPA catch-all 라우트가 존재하나, 해당 `solid-ts` 프로젝트는 이 저장소에 포함되어 있지 않음(별도 프로젝트를 같은 상위 폴더에 두고 함께 배포하는 구조로 추정)

### 프론트엔드 (`react-ts`)
- React 19 + React Router 7 + styled-components 기반 SPA, 라우트 단위 코드 스플리팅(`lazy`) 적용
- 페이지: 홈, 주식 분석(`StockAnalysis`, `lightweight-charts` 사용), 주식 계산기(`StockCalc`), 물타기 계산기(`AverDownCalc`), 바카라 계산기(`BacaraCalc`), 그리드 레이아웃 테스트(`GridReset`, `react-grid-layout`)
- 로그인/회원가입 및 일부 그리드 테스트 라우트는 플레이스홀더 상태("구현 예정")

## 스택
- 백엔드: Node.js, TypeScript, Express, MySQL2(MariaDB), ZeroMQ, JWT, Helmet
- 프론트엔드: React 19, TypeScript, Vite, React Router 7, styled-components, react-grid-layout, lightweight-charts
- 배포: IIS + iisnode (`node-ts/web.config` 존재)

## 폴더 구성
```
node-ts/         Express API 서버 (TypeScript)
  src/app.ts       엔트리 포인트
  src/routes       auth, files, admin, home, stockAnalysis 라우트
  src/controllers  인증/파일/관리자 컨트롤러
  src/models       User, File 모델
  src/stockAnalysis  주식 지표 분석 모듈(talib 연동)
  src/zeromq       ZMQ 브릿지
  web.config       IIS/iisnode 배포 설정
react-ts/        React SPA (TypeScript + Vite)
  src/pages        라우트별 페이지 컴포넌트
  src/features     stockAnalysis 관련 기능 모듈
  src/components   레이아웃/계산기 등 공용 컴포넌트
```

## 빌드·실행

### 백엔드 (`node-ts`)
```
cd node-ts
npm install
npm run dev     # nodemon + ts-node, NODE_ENV=production 강제 설정(package.json 정의값)
npm run build    # tsc 빌드 (dist/)
npm run start    # node dist/app.js
```
- MariaDB/MySQL 접속 정보 등은 `.env`로 주입(`.gitignore`에 명시, 저장소에는 포함되지 않음)
- IIS 배포 시 `web.config`(iisnode)를 사용

### 프론트엔드 (`react-ts`)
```
cd react-ts
npm install
npm run dev       # Vite 개발 서버
npm run build     # tsc -b && vite build
npm run preview   # 빌드 결과 미리보기
npm run lint       # ESLint
```

## 상태
개인용 포트폴리오/실험 프로젝트로 보이며, 라우팅 상 일부 페이지(로그인/회원가입, 그리드 테스트 일부)는 미구현 플레이스홀더 상태다. 백엔드가 참조하는 `solid-ts` 정적 빌드는 이 저장소에 포함되어 있지 않다.
