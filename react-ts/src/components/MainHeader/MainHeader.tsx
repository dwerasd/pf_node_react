import * as React from 'react';  // 중요: import 방식 변경
import { Link, useLocation } from 'react-router-dom';
import styles from '../../css/App.module.css';
import {
  HeaderContainer,
  LeftMenuSection,
  RightMenuSection,
  HomeLink,
  MenuLink,
  AuthMenuLink
} from './MainHeader.styles';

/**
 * 네비게이션 메뉴 아이템 타입 정의
 */
interface NavMenuItem {
  path: string;
  label: string;
  description?: string;
}

/**
 * MainHeader 컴포넌트의 Props 타입
 */
interface MainHeaderProps {
  className?: string;
}

/**
 * 좌측 메인 네비게이션 메뉴 데이터
 */
const MAIN_NAVIGATION_ITEMS: NavMenuItem[] = [
  { path: '/stock-analysis', label: '종목분석', description: '차트 및 보조지표 종합 분석' },
  { path: '/stockcalc', label: '주식계산기', description: '주식 투자 계산기' },
  { path: '/averdown', label: '주식물타기', description: '물타기(분할매수) 계산기' },
  { path: '/bacarabet', label: '바카라', description: '바카라 게임 페이지' },
  { path: '/test/grid1', label: '그리드1', description: '그리드 레이아웃 테스트 1' },
  { path: '/test/grid2', label: '그리드2', description: '그리드 레이아웃 테스트 2' },
  { path: '/test/grid3', label: '그리드3', description: '그리드 레이아웃 테스트 3' },
  { path: '/test/grid4', label: '그리드4', description: '그리드 레이아웃 테스트 4' },
];

/**
 * 우측 사용자 인증 메뉴 데이터
 */
const AUTH_NAVIGATION_ITEMS: NavMenuItem[] = [
  { path: '/signin', label: '로그인', description: '기존 계정으로 로그인' },
  { path: '/signup', label: '회원가입', description: '새 계정 만들기' }
];

/**
 * 네비게이션 링크 렌더링 함수
 * JSX.Element 대신 React.ReactElement 사용
 */
const renderNavLink = (
  item: NavMenuItem, 
  currentPath: string, 
  isAuthMenu: boolean = false
): React.ReactElement => {
  const isActive = currentPath === item.path;
  const LinkComponent = isAuthMenu ? AuthMenuLink : MenuLink;
  
  return (
    <LinkComponent key={item.path}>
      <Link
        to={item.path}
        className={isActive ? styles.active : styles.menulink}
        aria-label={item.description || item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        {item.label}
      </Link>
    </LinkComponent>
  );
};

/**
 * MainHeader 컴포넌트
 */
const MainHeader: React.FC<MainHeaderProps> = ({ className }) => {
  const currentLocation = useLocation();

  // 개발 환경에서만 로깅 (process.env 문제도 해결)
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log('Header 컴포넌트 마운트됨:', currentLocation.pathname);
    }

    return () => {
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.log('Header 클린업 함수 실행');
      }
    };
  }, [currentLocation.pathname]);

  return (
    <HeaderContainer className={className} role="banner">
      <LeftMenuSection role="navigation" aria-label="주요 네비게이션">
        <HomeLink>
          <Link 
            to="/" 
            className={styles.homelink}
            aria-label="홈페이지로 이동"
          >
            HOME
          </Link>
        </HomeLink>

        {MAIN_NAVIGATION_ITEMS.map(item => 
          renderNavLink(item, currentLocation.pathname)
        )}
      </LeftMenuSection>

      <RightMenuSection role="navigation" aria-label="사용자 메뉴">
        {AUTH_NAVIGATION_ITEMS.map(item => 
          renderNavLink(item, currentLocation.pathname, true)
        )}
      </RightMenuSection>
    </HeaderContainer>
  );
};

export default MainHeader;
