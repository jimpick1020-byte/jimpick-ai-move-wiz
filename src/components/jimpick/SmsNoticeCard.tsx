/**
 * 업체용 문자 알림 카드.
 *
 * 업체 화면에는 문자 사용 가능 여부와 내 업체 발송 현황만 보여 줍니다.
 * 알리고 설정값·환경변수 이름·테스트 발송은 서비스 관리자 화면에만 있습니다.
 */
import { Card } from "./ui";

export function SmsNoticeCard() {
  return (
    <Card className="space-y-2">
      <div className="text-base font-bold text-foreground">문자 알림</div>
      <p className="text-sm text-muted-foreground">아래 사업자 정보에 연락처를 등록해 주세요.</p>
    </Card>
  );
}
