-- 002_create_wedding_config.sql
-- 청첩장 설정 정보(이름, 날짜, 주소 등)를 Supabase DB에 보관하는 테이블 생성 쿼리입니다.
-- 규칙 7 준수: supabase/migrations 폴더 내에 순서 번호를 붙여 보관합니다.

-- 1. 청첩장 설정 테이블 생성
CREATE TABLE IF NOT EXISTS public.wedding_config (
    id INT PRIMARY KEY DEFAULT 1, -- 항상 하나의 행(1번)만 유지하여 관리합니다.
    config_data TEXT NOT NULL,    -- 암호화된 청첩장 전체 정보 문자열이 통째로 들어갑니다.
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT check_single_row CHECK (id = 1) -- id가 1 이외의 숫자가 되지 못하도록 강제하여 실수로 여러 설정이 생기는 것을 막습니다.
);

-- 2. 초기 기본 데이터를 설정합니다. (만약 행이 하나도 없다면 1번 행을 생성)
-- config_data의 기본값은 비어있으며, 브라우저가 최초 실행 시 로드해서 값이 없을 경우 DEFAULT_CONFIG를 주입하도록 구현합니다.
INSERT INTO public.wedding_config (id, config_data)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

-- 3. RLS 보안 활성화
ALTER TABLE public.wedding_config ENABLE ROW LEVEL SECURITY;

-- 4. RLS 보안 정책 설정
-- 하객들이 이 정보를 불러와야 하므로 누구나 읽을 수 있게 허용합니다. (SELECT)
CREATE POLICY "설정 정보 누구나 읽기 허용" 
ON public.wedding_config 
FOR SELECT 
USING (true);

-- 설정값 수정 및 덮어쓰기는 관리자 인증 절차(비밀번호 검증)를 거친 후 자바스크립트가 수행하므로 
-- DB 차원에서는 일단 모두 쓰기를 허용해 둡니다. (UPDATE/INSERT)
CREATE POLICY "설정 정보 누구나 쓰기 허용" 
ON public.wedding_config 
FOR UPDATE 
USING (true);

CREATE POLICY "설정 정보 누구나 입력 허용" 
ON public.wedding_config 
FOR INSERT 
WITH CHECK (true);

-- 5. 실시간(Realtime) 기능 활성화
-- 관리자가 PC에서 청첩장 정보를 수정하면, 다른 모든 하객의 폰 화면에서도 새로고침 없이 이름이나 정보가 실시간으로 바뀝니다.
ALTER PUBLICATION supabase_realtime ADD TABLE public.wedding_config;
