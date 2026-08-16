import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';

export default function DataRouteLoader() {
  const { pathname } = useLocation();
  const { loadPosts, loadEvents, loadMyAttendance } = useData();

  useEffect(() => {
    if (pathname === '/') {
      void loadPosts();
      return;
    }

    if (pathname === '/mural') {
      void loadEvents();
      void loadMyAttendance();
      return;
    }

    if (pathname === '/mapa') {
      void loadPosts();
      void loadEvents();
    }
  }, [pathname, loadPosts, loadEvents, loadMyAttendance]);

  return null;
}
