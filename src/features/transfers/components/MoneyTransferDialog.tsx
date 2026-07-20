import { useEffect, useState } from 'react';
import { WalletCards } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MoneyTransferHistory } from '@/features/transfers/components/MoneyTransferHistory';
import { MoneyTransferSend } from '@/features/transfers/components/MoneyTransferSend';
import { formatMoney } from '@/features/transfers/format';
import type { Profile } from '@/types/database';

type WalletTab = 'send' | 'history';

interface MoneyTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: WalletTab;
  profile: Profile;
  refreshProfile: () => Promise<void>;
  updateProfileBalance: (balance: number) => void;
}

export default function MoneyTransferDialog({
  open,
  onOpenChange,
  initialTab = 'send',
  profile,
  refreshProfile,
  updateProfileBalance,
}: MoneyTransferDialogProps) {
  const [tab, setTab] = useState<WalletTab>(initialTab);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [initialTab, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submitting) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.25rem)] max-w-lg overflow-hidden rounded-2xl border-border/70 p-0 sm:w-full">
        <div className="border-b border-border/70 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-5 pb-4 pt-5">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <WalletCards className="h-5 w-5" />
            </div>
            <DialogTitle className="text-left text-xl">Portfel</DialogTitle>
            <DialogDescription className="text-left">
              Dostępne saldo:{' '}
              <strong className="text-foreground">
                {formatMoney(Number(profile.balance))} zł
              </strong>
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as WalletTab)}
        >
          <div className="px-5 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send">Wyślij</TabsTrigger>
              <TabsTrigger value="history">Historia</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="send"
            className="m-0 h-[min(430px,calc(100dvh-13rem))] overflow-y-auto px-5 pb-5 pt-4"
          >
            <MoneyTransferSend
              profile={profile}
              refreshProfile={refreshProfile}
              updateProfileBalance={updateProfileBalance}
              onCompleted={() => setTab('history')}
              onSubmittingChange={setSubmitting}
            />
          </TabsContent>

          <TabsContent
            value="history"
            className="m-0 h-[min(430px,calc(100dvh-13rem))] overflow-y-auto px-5 pb-5 pt-4"
          >
            <MoneyTransferHistory />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
