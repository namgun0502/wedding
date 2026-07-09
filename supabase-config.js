/* ==========================================================================
   [supabase-config.js] Supabase 클라우드 연결 설정 파일
   
   ★ 남건 님! 이 파일은 청첩장을 Supabase 클라우드 데이터베이스에 연결하는 징검다리입니다.
   
   1. Supabase(https://supabase.com)에 로그인하신 뒤 생성한 프로젝트 대시보드로 이동합니다.
   2. 설정(Settings) -> API 메뉴로 이동합니다.
   3. API Settings에 있는 두 가지 값을 아래의 큰따옴표("") 사이에 각각 복사해서 붙여넣어 주세요!
      - Project URL -> SUPABASE_URL 에 입력
      - anon / public (API Key) -> SUPABASE_ANON_KEY 에 입력
   
   ※ 주의: 위아래의 큰따옴표("") 기호는 절대 지우지 말고 그 안의 내용만 변경해 주세요.
   ========================================================================== */

const SUPABASE_CONFIG = {
  // 여기에 프로젝트 URL을 넣어주세요. (예: "https://abcdefghyjkl.supabase.co")
  SUPABASE_URL: "https://qzhgsshyhmnczmreagqd.supabase.co",
  
  // 여기에 anon public 키를 넣어주세요. (예: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...")
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6aGdzc2h5aG1uY3ptcmVhZ3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzc0NzksImV4cCI6MjA5Nzg1MzQ3OX0.2NZxyClmIpj7WtUuZtexZqAMuTnC7udF5FejwitzvcU"
};
