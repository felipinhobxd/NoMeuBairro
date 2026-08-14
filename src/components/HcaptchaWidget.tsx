import { useRef, useState } from 'react';
import HCaptcha, { type HCaptcha as HCaptchaInstance } from '@hcaptcha/react-hcaptcha';

const SITEKEY = 'a306b7dc-5146-4ae0-b146-eefac760b3c2';

export default function HcaptchaWidget({ onToken }: { onToken: (token: string) => void }) {
  const captchaRef = useRef<HCaptchaInstance>(null);
  const [error, setError] = useState('');

  return (
    <div className="flex flex-col items-center gap-2">
      <HCaptcha
        ref={captchaRef}
        sitekey={SITEKEY}
        onVerify={(token) => {
          setError('');
          onToken(token);
        }}
        onExpire={() => onToken('')}
        onError={() => {
          onToken('');
          setError('Não foi possível carregar a verificação. Atualize a página e tente novamente.');
        }}
      />
      {error && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}

export function resetHcaptcha(ref: React.RefObject<HCaptchaInstance | null>) {
  ref.current?.resetCaptcha();
}
