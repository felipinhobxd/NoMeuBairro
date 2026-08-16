import Profile from './Profile';
import ProfileActivity from '../components/ProfileActivity';
import ModerationPanel from '../components/ModerationPanel';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="space-y-6">
      <Profile />
      {isAuthenticated && user && (
        <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
          <ProfileActivity userId={user.id} accountType={user.accountType} />
          <ModerationPanel />
        </div>
      )}
    </div>
  );
}
