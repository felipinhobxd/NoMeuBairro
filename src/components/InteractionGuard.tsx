import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

const ATTENDANCE_KEY = 'nmb-attending-events';
const GREEN_CLASSES = ['!bg-emerald-600', '!text-white', '!hover:bg-emerald-700', '!ring-0'];

function readAttendance(): Set<string> {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    return new Set<string>(JSON.parse(raw || '[]'));
  } catch {
    return new Set<string>();
  }
}

function writeAttendance(ids: Set<string>) {
  try {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify([...ids]));
  } catch {}
}

function setAttendanceVisual(button: HTMLButtonElement, active: boolean) {
  for (const cls of GREEN_CLASSES) button.classList.toggle(cls, active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  if (active) button.title = 'Você vai comparecer';
  else button.title = 'Marcar presença';
}

export default function InteractionGuard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const refreshAttendance = async () => {
      const localIds = readAttendance();
      if (!isAuthenticated || !user) {
        document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]').forEach(button => {
          if (button.textContent?.includes('Vou comparecer')) setAttendanceVisual(button, false);
        });
        return;
      }

      const { data } = await supabase.from('event_attendance').select('event_id').eq('user_id', user.id);
      if (cancelled) return;
      const ids = new Set<string>((data || []).map(row => row.event_id as string));
      for (const id of localIds) if (!ids.has(id)) localIds.delete(id);
      for (const id of ids) localIds.add(id);
      writeAttendance(localIds);

      document.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
        if (!button.textContent?.includes('Vou comparecer')) return;
        const card = button.closest('[id^="ev-"]');
        const eventId = card?.id.replace(/^ev-/, '');
        if (eventId) setAttendanceVisual(button, ids.has(eventId));
      });
    };

    const styleAttendanceButtons = () => {
      const ids = readAttendance();
      document.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
        if (!button.textContent?.includes('Vou comparecer')) return;
        const card = button.closest('[id^="ev-"]');
        const eventId = card?.id.replace(/^ev-/, '');
        if (eventId) setAttendanceVisual(button, ids.has(eventId));
      });
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest('button') as HTMLButtonElement | null;
      if (!button) return;

      // Apoiar um relato exige conta autenticada.
      if (button.getAttribute('aria-label') === 'Apoiar' && !isAuthenticated) {
        event.preventDefault();
        event.stopPropagation();
        navigate('/login');
        return;
      }

      // Presença em evento também exige conta e mantém o estado visual verde.
      if (button.textContent?.includes('Vou comparecer')) {
        const card = button.closest('[id^="ev-"]');
        const eventId = card?.id.replace(/^ev-/, '');
        if (!eventId) return;
        if (!isAuthenticated) {
          event.preventDefault();
          event.stopPropagation();
          navigate('/login');
          return;
        }
        const ids = readAttendance();
        if (ids.has(eventId)) ids.delete(eventId);
        else ids.add(eventId);
        writeAttendance(ids);
        setAttendanceVisual(button, ids.has(eventId));
      }
    };

    document.addEventListener('click', onClickCapture, true);
    const observer = new MutationObserver(styleAttendanceButtons);
    observer.observe(document.body, { subtree: true, childList: true });
    styleAttendanceButtons();
    void refreshAttendance();

    return () => {
      cancelled = true;
      document.removeEventListener('click', onClickCapture, true);
      observer.disconnect();
    };
  }, [isAuthenticated, user, navigate, location.pathname]);

  return null;
}
