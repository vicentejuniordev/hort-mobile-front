import { useState } from 'react';
import { useSession } from '@/shared/session/SessionProvider';
import { Button } from '@/shared/ui/Button';
import { NoticeDialog } from '@/shared/ui/NoticeDialog';

export function SignOutButton() {
  const [confirm, setConfirm] = useState(false);
  const { signOut } = useSession();
  return (
    <>
      <Button label="Sair da conta" onPress={() => setConfirm(true)} />
      <NoticeDialog
        visible={confirm}
        title="Sair da conta?"
        message="Ao confirmar, tentaremos encerrar as sessões da sua conta em todos os dispositivos. Sem conexão, a saída será apenas deste aparelho."
        closeLabel="Cancelar"
        onClose={() => setConfirm(false)}
        action={{
          label: 'Sair da conta',
          onPress: () => {
            setConfirm(false);
            void signOut().catch(() => undefined);
          },
        }}
      />
    </>
  );
}
