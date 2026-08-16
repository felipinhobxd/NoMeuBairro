import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

const GREEN_CLASSES = ['!bg-emerald-600', '!text-white', '!hover:bg-emerald-700', '!ring-0'];

function setAttendanceVisual(button: HTMLButtonElement, active: boolean) {
  for (const cls of GREEN_CLASSES) button.classList.toggle(cls, active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.title = active ? 'Você vai comparecer' : 'Marcar presença';
}

export default function InteractionGuard() {
  const { isAuthenticated } = useAuth();
  const { attendingEventIds, loadComments } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let frame = 0;

    const styleAttendanceButtons = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
          if (!button.textContent?.includes('Vou comparecer')) return;
          const card = button.closest('[id^="ev-"]');
          const eventId = card?.id.replace(/^ev-/, '');
          if (eventId) setAttendanceVisual(button, isAuthenticated && attendingEventIds.has(eventId));
        });
      });
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest('button') as HTMLButtonElement | null;
      if (!button) return;

      if (button.getAttribute('aria-label') === 'Apoiar' && !isAuthenticated) {
        event.preventDefault();
        event.stopPropagation();
        navigate('/login');
        return;
      }

      // Os textos dos comentários só são transferidos quando a conversa é aberta.
      if (button.textContent?.includes('Comentário')) {
        const card = button.closest('[id^="post-"]');
        const postId = card?.id.replace(/^post-/, '');
        if (postId && button.getAttribute('aria-expanded') !== 'true') void loadComments(postId);
      }

      if (button.textContent?.includes('Vou comparecer') && !isAuthenticated) {
        event.preventDefault();
        event.stopPropagation();
        navigate('/login');
      }
    };

    document.addEventListener('click', onClickCapture, true);
    const observer = new MutationObserver(styleAttendanceButtons);
    observer.observe(document.body, { subtree: true, childList: true });
    styleAttendanceButtons();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onClickCapture, true);
      observer.disconnect();
    };
  }, [isAuthenticated, attendingEventIds, loadComments, navigate, location.pathname]);

  return null;
}
