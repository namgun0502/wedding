-- 003_create_visitor_logs_table.sql
-- 식장에 도착한 하객들의 방문 기록(체크인 로그)을 보관하는 테이블 생성 쿼리입니다.
-- 테이블간 충돌 방지를 위해 테이블명을 'wedding_visitor_logs'로 변경합니다.
-- 규칙 7 준수: supabase/migrations 폴더 내에 순서 번호를 붙여 보관합니다.

-- 1. 방문자 로그 테이블 생성
CREATE TABLE IF NOT EXISTS public.wedding_visitor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_name TEXT NOT NULL,
    relation TEXT NOT NULL, -- 신랑 친구, 신부 친척, 직장 동료 등
    visited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. RLS(Row Level Security, 행 단위 보안) 활성화
ALTER TABLE public.wedding_visitor_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS 보안 정책 설정
CREATE POLICY "방문자 기록 누구나 읽기 허용" 
ON public.wedding_visitor_logs 
FOR SELECT 
USING (true);

CREATE POLICY "방문자 기록 누구나 쓰기 허용" 
ON public.wedding_visitor_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "방문자 기록 누구나 삭제 허용" 
ON public.wedding_visitor_logs 
FOR DELETE 
USING (true);

-- 4. 실시간(Realtime) 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.wedding_visitor_logs;
