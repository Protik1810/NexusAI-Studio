import React from 'react';
import { AlertTriangle, X, CheckCircle, Info } from 'lucide-react';

export interface ModalProps {
  show: boolean;
  type?: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  onClose: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const ErrorModal: React.FC<ModalProps> = ({
  show,
  type = 'error',
  title,
  message,
  onClose,
  actionText,
  onAction
}) => {
  if (!show) return null;

  const isSuccess = type === 'success';
  const isInfo = type === 'info';

  const defaultTitle = isSuccess ? 'Success!' : isInfo ? 'Information' : 'Attention Required';
  const iconColor = isSuccess ? '#10b981' : isInfo ? '#06b6d4' : '#ef4444';
  const iconBg = isSuccess ? 'rgba(16, 185, 129, 0.15)' : isInfo ? 'rgba(6, 182, 212, 0.15)' : 'rgba(239, 68, 68, 0.15)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="modal-icon" style={{ background: iconBg, color: iconColor }}>
            {isSuccess ? <CheckCircle size={26} /> : isInfo ? <Info size={26} /> : <AlertTriangle size={26} />}
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', padding: '6px', color: 'var(--text-secondary)', borderRadius: '50%', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left', marginTop: '8px' }}>
          {title || defaultTitle}
        </h3>

        <div style={{ maxHeight: '240px', overflowY: 'auto', textAlign: 'left' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {message}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          {actionText && onAction && (
            <button 
              onClick={() => { onAction(); onClose(); }}
              style={{ background: 'var(--accent)', color: '#fff', padding: '9px 18px', fontSize: '13px' }}
            >
              {actionText}
            </button>
          )}
          <button 
            onClick={onClose} 
            style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '9px 18px', fontSize: '13px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
