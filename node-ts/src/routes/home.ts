import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.send('메인페이지');
});

router.get('/stockcalc', (req, res) => {
  res.send('주식계산기 페이지');
});

router.get('/bacarabet', (req, res) => {
  res.send('바카라 게임 페이지');
});

// 새로 추가된 주식 물타기(분할매수) 계산기 페이지 라우트
router.get('/averdown', (req, res) => {
  res.send('주식물타기 계산기 페이지');
});

router.get('/test/grid1', (req, res) => {
  res.send('그리드 레이아웃 테스트 1');
});

router.get('/test/grid2', (req, res) => {
  res.send('그리드 레이아웃 테스트 2');
});

router.get('/test/grid3', (req, res) => {
  res.send('그리드 레이아웃 테스트 3');
});

router.get('/test/grid4', (req, res) => {
  res.send('그리드 레이아웃 테스트 4');
});

export default router;