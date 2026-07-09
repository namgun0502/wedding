-- 005_create_tickets_table.sql
-- 하객별 고유 모바일 입장 티켓을 식별하고 검증하는 테이블 생성 쿼리입니다.
-- 규칙 7 준수: supabase/migrations 폴더 내에 순서 번호를 붙여 보관합니다.

-- 1. 입장 티켓 테이블 생성
CREATE TABLE IF NOT EXISTS public.wedding_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 고유 위조 방지 식별키 (UUID)
    guest_name TEXT NOT NULL,                     -- 하객 성함
    relation TEXT NOT NULL,                       -- 하객 관계 (예: 신랑 친구)
    is_used BOOLEAN DEFAULT FALSE NOT NULL,       -- 사용(입장) 여부
    used_at TIMESTAMPTZ,                          -- 입장 승인 시각
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL  -- 티켓 발급 시각
);

-- 2. RLS(Row Level Security) 활성화
ALTER TABLE public.wedding_tickets ENABLE ROW LEVEL SECURITY;

-- 3. RLS 보안 정책 설정
-- 관계자가 티켓을 스캔하여 조회할 수 있도록 SELECT 정책 수립
CREATE POLICY "티켓 조회 누구나 허용" 
ON public.wedding_tickets 
FOR SELECT 
USING (true);

-- 관리자가 관리자 패널에서 하객 QR 생성 시 티켓을 삽입(INSERT)할 수 있도록 허용
CREATE POLICY "티켓 발급 누구나 허용" 
ON public.wedding_tickets 
FOR INSERT 
WITH CHECK (true);

-- 관계자 스캔 시 티켓을 사용됨(UPDATE) 상태로 변경할 수 있도록 허용
CREATE POLICY "티켓 입장 승인 누구나 허용" 
ON public.wedding_tickets 
FOR UPDATE 
USING (true);

-- 4. 실시간(Realtime) 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.wedding_tickets;
