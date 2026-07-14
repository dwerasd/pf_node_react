/**
 * styled-components 모듈 확장
 * DefaultTheme 인터페이스에 우리의 테마 타입을 적용
 * 이렇게 해야 styled-components에서 theme 자동완성이 작동함
 */
import 'styled-components';
import { Theme } from './theme';

declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}
