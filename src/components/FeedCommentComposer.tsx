import { Send } from 'lucide-react';

type Props = {
  authorName: string;
  value: string;
  replyToName?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

/** Keep the send target in normal flow: it cannot overlap the text field or
 * depend on the absolute positioning of a tiny icon on touch screens. */
export default function FeedCommentComposer({ authorName, value, replyToName, onChange, onSubmit }: Props) {
  return <div className="nmb-comment-composer">
    <div aria-hidden="true" className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{authorName.charAt(0).toUpperCase()}</div>
    <div className="nmb-comment-field">
      <textarea
        aria-label="Escreva um comentário"
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={replyToName !== undefined ? `Responder a ${replyToName}...` : 'Escreva um comentário...'}
        rows={2}
        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
      />
      <button type="button" onClick={onSubmit} disabled={!value.trim()} className="nmb-comment-submit" aria-label="Enviar" title="Enviar comentário"><Send aria-hidden="true" className="w-4 h-4" /></button>
    </div>
  </div>;
}
