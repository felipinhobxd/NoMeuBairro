import { useEffect } from 'react';

function formatBrazilWhatsapp(value: string): string {
  const allDigits = value.replace(/\D/g, '');
  const local = allDigits.startsWith('55') ? allDigits.slice(2) : allDigits;
  const digits = local.slice(0, 11);
  if (!digits) return '+55 ';

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (!rest) return `+55 (${ddd}`;

  const groups = rest.length > 8
    ? `${rest.slice(0, 5)}-${rest.slice(5, 9)}`
    : `${rest.slice(0, 4)}${rest.length > 4 ? `-${rest.slice(4, 8)}` : ''}`;

  return `+55 (${ddd}) ${groups}`.trimEnd();
}

export default function BrazilWhatsappMask() {
  useEffect(() => {
    const isWhatsappInput = (target: EventTarget | null): target is HTMLInputElement => {
      if (!(target instanceof HTMLInputElement)) return false;
      const hint = `${target.placeholder} ${target.name} ${target.getAttribute('aria-label') || ''}`.toLowerCase();
      return hint.includes('whatsapp');
    };

    const formatTarget = (target: HTMLInputElement) => {
      const formatted = formatBrazilWhatsapp(target.value);
      if (formatted !== target.value) {
        target.value = formatted;
      }
    };

    const onFocus = (event: FocusEvent) => {
      if (isWhatsappInput(event.target)) {
        formatTarget(event.target);
      }
    };

    const onInput = (event: Event) => {
      if (isWhatsappInput(event.target)) {
        formatTarget(event.target);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isWhatsappInput(event.target)) return;
      const input = event.target;
      if (event.key.length === 1 && /\d/.test(event.key) && input.value.replace(/\D/g, '').length >= 13) {
        event.preventDefault();
      }
    };

    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  return null;
}
