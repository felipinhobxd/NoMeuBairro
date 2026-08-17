import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PublicProfile from './PublicProfile';

export default function PublicProfileRoute() {
  const { userId } = useParams();
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && user?.id && userId === user.id) {
    return <Navigate to="/perfil" replace />;
  }

  return <PublicProfile />;
}
