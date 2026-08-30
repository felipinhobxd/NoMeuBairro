import { useId, useState, type ReactNode } from 'react';

/** Colunas no desktop; escolha direta de seção quando a tela só comporta uma. */
export default function ProfileSections({ activity, information, activityLabel = 'Minha atividade' }: {
  activity: ReactNode;
  information: ReactNode;
  activityLabel?: string;
}) {
  const [section, setSection] = useState<'activity' | 'information'>('activity');
  const id = useId();

  return (
    <>
      <div className="nmb-profile-section-switch" role="group" aria-label="Seções do perfil">
        <button type="button" aria-pressed={section === 'activity'} aria-controls={`${id}-activity`} onClick={() => setSection('activity')}>{activityLabel}</button>
        <button type="button" aria-pressed={section === 'information'} aria-controls={`${id}-information`} onClick={() => setSection('information')}>Informações e selos</button>
      </div>
      <div className="nmb-profile-grid" data-section={section}>
        <section id={`${id}-activity`} className="nmb-profile-content" aria-label={activityLabel}>{activity}</section>
        <aside id={`${id}-information`} className="nmb-profile-sidebar" aria-label="Informações do perfil">{information}</aside>
      </div>
    </>
  );
}
