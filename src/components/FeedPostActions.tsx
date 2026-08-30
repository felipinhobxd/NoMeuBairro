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
    <div className="nmb-post-engagement">
      <span className="nmb-post-support-total"><Heart aria-hidden="true" /><span>{props.supports} {props.supports === 1 ? 'apoio' : 'apoios'}</span></span>
      <span className="nmb-post-comment-total" aria-live="polite" aria-atomic="true">{props.commentsCount} {props.commentsCount === 1 ? 'comentário' : 'comentários'}</span>
      <button ref={moreButton} type="button" className="nmb-post-more" aria-label="Mais opções do relato" title="Denunciar, abrir, salvar e outras opções" aria-expanded={optionsOpen} aria-controls={optionsId} onClick={() => setOptionsOpen(open => !open)}><MoreHorizontal aria-hidden="true" /></button>
    </div>

    <div className="nmb-post-actions" role="group" aria-label="Ações da publicação">
      <button type="button" onClick={props.onSupport} aria-label="Apoiar" aria-pressed={props.supported} className="nmb-post-action">
        <Heart aria-hidden="true" className={cn(props.supported && 'fill-current', props.heartAnimating && 'animate-heart-pop')} /><span>{props.supported ? 'Apoiado' : 'Apoiar'}</span>
      </button>
      <button type="button" onClick={props.onComments} aria-label={`Comentários (${props.commentsCount})`} aria-expanded={props.commentsExpanded} aria-controls={props.commentsExpanded ? `post-comments-${props.postId}` : undefined} className="nmb-post-action">
        <MessageSquare aria-hidden="true" /><span>Comen&shy;tar</span>
      </button>
      <button type="button" onClick={props.onShare} aria-label="Compartilhar relato" className="nmb-post-action">
        <Share2 aria-hidden="true" /><span>Compar&shy;tilhar</span>
      </button>
    </div>

    <div id={optionsId} className="nmb-post-options" hidden={!optionsOpen} role="group" aria-label="Outras opções do relato">
      <div className="nmb-post-secondary-actions">
        <button type="button" onClick={props.onReport}><AlertTriangle aria-hidden="true" />Denunciar</button>
        <Link to={`/post/${props.postId}`}><ExternalLink aria-hidden="true" />Abrir</Link>
        <button type="button" onClick={props.onSave} aria-pressed={props.saved}><Bookmark aria-hidden="true" className={cn(props.saved && 'fill-current')} />{props.saved ? 'Salvo' : 'Salvar'}</button>
      </div>
      {props.canManageStatus && <div className="nmb-post-status-actions" role="group" aria-label="Atualizar situação do relato">
        <span>Atualizar situação</span>
        {statuses.filter(item => item.id !== props.status).map(item => <button type="button" key={item.id} data-status={item.id} onClick={() => props.onStatus(item.id)}><CheckCircle2 aria-hidden="true" />{item.label}</button>)}
      </div>}
    </div>
  </div>;
}
