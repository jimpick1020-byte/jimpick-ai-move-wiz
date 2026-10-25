import { Camera, Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useApp } from '@/lib/jimpick';

export function AiScanMenu() {
  const { setScreen, customerFlow } = useApp();
  if (customerFlow) return null;
  return <div className="flex justify-end px-4 pb-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" aria-label="더보기"><Ellipsis className="size-5" />더보기</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setScreen('scan')}><Camera className="size-4" />AI 촬영</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
}