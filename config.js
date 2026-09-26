/* =====================================================================
   SPOTPLAN 설정 파일 (config.js)
   Supabase 를 만든 뒤 SUPABASE_URL, SUPABASE_KEY 두 값만 채우면 실제 운영 모드가 됩니다.
   비워 두면 "시험 모드"(이 브라우저 안에만 저장)로 동작합니다.
   자세한 방법: SETUP_GUIDE.md 8장
   ===================================================================== */
window.SPOTPLAN_CONFIG = {
  SUPABASE_URL: 'https://ornuemfdueukfedkehyh.supabase.co',
  SUPABASE_KEY: 'sb_publishable_0nOlUcOaXbh-G-Mfkb_apw_3SIvpjEC', // Publishable key (sb_publishable_… 로 시작). 공개돼도 되는 키입니다. Secret key는 절대 넣지 마세요.
  STUDIO_NAME: '스팟스튜디오',
  BRAND_NAME: 'SpotStudio',        // 화면 왼쪽 위 로고 옆 이름
  LABEL_CUSTOMER: '고객 요청서',   // 고객 화면(요청서·제안서)에서 이름 옆에 붙는 말
  LABEL_STUDIO: '온라인 기획서',   // 실장·직원 화면에서 이름 옆에 붙는 말
  STUDIO_PHONE: '02-6080-9777',
  RENTAL_URL: '',          // 아워플레이스 스팟스튜디오 페이지 주소 (비우면 안내 문구만 표시)
  PRIVACY_RETENTION: '상담 종료 후 1년 (삭제 요청 시 즉시 삭제)',
  PRIVACY_AI_NOTE: '상담 내용 정리에 AI 서비스(Anthropic Claude)를 활용할 수 있습니다.'
};
