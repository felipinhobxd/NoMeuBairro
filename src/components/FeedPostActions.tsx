import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bookmark, CheckCircle2, ExternalLink, Heart, MessageSquare, MoreHorizontal, Share2 } from 'lucide-react';
import type { PostStatus } from '../types';
import { cn } from '../utils/cn';

const statuses: { id: PostStatus; label: string }[] = [
  { id: 'pending', label: 'Aberto' },
  { id: 'in_progress', label: 'Em andamento' },
  { id: 'resolved', label: 'Resolvido' },
];

function compactCount(value: number) {
  return value > 99 ? '99+' : String(Math.max(0, value));
}

type Props = {
  postId: string;
  supports: number;
  commentsCount: number;
  supported: boolean;
  heartAnimating: boolean;
  commentsExpanded: boolean;
  saved: boolean;
  status: PostStatus;
  canManageStatus: boolean;
  onSupport: () => void;
  onComments: () => void;
  onShare: () => void;
  onReport: () => void;
  onSave: () => void;
  onStatus: (status: PostStatus) => void;
};

export default function FeedPostActions(props: Props) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const optionsId = `post-options-${props.postId}`;

  return <div className="nmb-post-footer" onKeyDown={event => {
    if (event.key === 'Escape' && optionsOpen) {
      event.stopPropagation();
      setOptionsOpen(false);
      moreButton.current?.focus();
    }
  }}>
    <div className="nmb-post-engagement justify-end">
      <button ref={moreButton} type="button" className="nmb-post-more" aria-label="Mais opções do relato" title="Denunciar, abrir e salvar" aria-expanded={optionsOpen} aria-controls={optionsId} onClick={() => setOptionsOpen(open => !open)}><MoreHorizontal aria-hidden="true" /></button>
    </div>

    <div className="nmb-post-actions" role="group" aria-label="Ações da publicação">
      <button type="button" onClick={props.onSupport} aria-label={`Apoiar — ${props.supports} ${props.supports === 1 ? 'apoio' : 'apoios'}`} aria-pressed={props.supported} className="nmb-post-action">
        <span className="relative inline-flex shrink-0 items-center justify-center">
          <Heart aria-hidden="true" className={cn('h-[1.1rem] w-[1.1rem]', props.supported && 'fill-current', props.heartAnimating && 'animate-heart-pop')} />
          <span aria-hidden="true" className="absolute -right-3 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-orange-400 dark:text-slate-950">{compactCount(props.supports)}</span>
        </span>
        <span>{props.supported ? 'Apoiado' : 'Apoiar'}</span>
      </button>
      <button type="button" onClick={props.onComments} aria-label={`Comentar — ${props.commentsCount} ${props.commentsCount === 1 ? 'comentário' : 'comentários'}`} aria-expanded={props.commentsExpanded} aria-controls={props.commentsExpanded ? `post-comments-${props.postId}` : undefined} className="nmb-post-action">
        <span className="relative inline-flex shrink-0 items-center justify-center">
          <MessageSquare aria-hidden="true" className="h-[1.1rem] w-[1.1rem]" />
          <span aria-hidden="true" className="absolute -right-3 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-orange-400 dark:text-slate-950">{compactCount(props.commentsCount)}</span>
        </span>
        <span>Comen&shy;tar</span>
      </button>
      <button type="button" onClick={props.onShare} aria-label="Compartilhar relato" className="nmb-post-action">
        <Share2 aria-hidden="true" /><span>Compar&shy;tilhar</span>
      </button>
    </div>

    {props.canManageStatus && <div className="nmb-post-status-actions" role="group" aria-label="Atualizar situação do relato">
      <span>Atualizar situação</span>
      {statuses.filter(item => item.id !== props.status).map(item => <button type="button" key={item.id} data-status={item.id} onClick={() => props.onStatus(item.id)}><CheckCircle2 aria-hidden="true" />{item.label}</button>)}
    </div>}

    <div id={optionsId} className="nmb-post-options" hidden={!optionsOpen} role="group" aria-label="Outras opções do relato">
      <div className="nmb-post-secondary-actions">
        <button type="button" onClick={props.onReport}><AlertTriangle aria-hidden="true" />Denunciar</button>
        <Link to={`/post/${props.postId}`}><ExternalLink aria-hidden="true" />Abrir</Link>
        <button type="button" onClick={props.onSave} aria-pressed={props.saved}><Bookmark aria-hidden="true" className={cn(props.saved && 'fill-current')} />{props.saved ? 'Salvo' : 'Salvar'}</button>
      </div>
    </div>
  </div>;
}
