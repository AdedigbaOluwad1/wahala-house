import { CalendarCheck } from 'lucide-react';
import { strings } from '../../content/strings/en';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function QuarterPrompt({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarCheck className="size-5 text-primary" aria-hidden="true" />{strings.quarterTitle}</DialogTitle>
          <DialogDescription>{strings.quarterBody}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button size="lg" onClick={onConfirm}>{strings.quarterConfirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
