-- 004_create_admin_auth_table.sql
-- 관리자 인증 비밀번호를 독립적으로 안전하게 관리하는 테이블 생성 쿼리입니다.
-- 규칙 7 준수: supabase/migrations 폴더 내에 순서 번호를 붙여 보관합니다.

-- 1. 관리자 인증 테이블 생성
CREATE TABLE IF NOT EXISTS public.wedding_admin_auth (
    id INT PRIMARY KEY DEFAULT 1, -- 단일 행(1번)으로만 관리합니다.
    password_hash TEXT NOT NULL,  -- 암호화된 비밀번호 문자열
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT check_single_admin CHECK (id = 1)
);

-- 2. 초기 기본 비밀번호 설정 (1234 를 XOR + Base64 해시한 진짜 올바른 값: MTI0LDEyNywxMjYsMTIx)
-- 만약 기존에 데이터가 없다면 기본값 1234로 초기 세팅합니다.
INSERT INTO public.wedding_admin_auth (id, password_hash)
VALUES (1, 'MTI0LDEyNywxMjYsMTIx')
ON CONFLICT (id) DO NOTHING;

-- 3. RLS(Row Level Security) 활성화
ALTER TABLE public.wedding_admin_auth ENABLE ROW LEVEL SECURITY;

-- 4. RLS 보안 정책 설정
CREATE POLICY "비밀번호 검증 누구나 읽기 허용" 
ON public.wedding_admin_auth 
FOR SELECT 
USING (true);

CREATE POLICY "비밀번호 누구나 수정 허용" 
ON public.wedding_admin_auth 
FOR UPDATE 
USING (true);

-- 5. 실시간(Realtime) 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.wedding_admin_auth;
