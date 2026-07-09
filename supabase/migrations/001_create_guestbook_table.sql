-- 001_create_guestbook_table.sql
-- 방명록 테이블을 생성하는 SQL 쿼리입니다.
-- 테이블간 충돌 방지를 위해 테이블명을 'wedding_guestbook'으로 변경합니다.
-- 규칙 7 준수: supabase/migrations 폴더 내에 순서 번호를 붙여 보관합니다.

-- 1. 방명록 테이블 생성
CREATE TABLE IF NOT EXISTS public.wedding_guestbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    password_hash TEXT NOT NULL, -- 암호화된 삭제용 비밀번호가 저장됩니다.
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. RLS(Row Level Security, 행 단위 보안) 활성화
ALTER TABLE public.wedding_guestbook ENABLE ROW LEVEL SECURITY;

-- 3. RLS 보안 정책(Policy) 설정
CREATE POLICY "방명록 누구나 읽기 허용" 
ON public.wedding_guestbook 
FOR SELECT 
USING (true);

CREATE POLICY "방명록 누구나 쓰기 허용" 
ON public.wedding_guestbook 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "방명록 누구나 삭제 허용" 
ON public.wedding_guestbook 
FOR DELETE 
USING (true);

-- 4. 실시간(Realtime) 기능 활성화
-- 새 축하글이 등록되었을 때 모든 사람의 화면에 실시간으로 즉시 나타나게 만드는 Supabase 고유 설정입니다.
ALTER PUBLICATION supabase_realtime ADD TABLE public.wedding_guestbook;
