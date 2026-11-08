import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Icon } from './UI';

/**
 * In-app PDF viewer.
 *
 * The PDF is fetched with the JWT in the Authorization header and displayed
 * from a short-lived blob URL - no public/storage URL is ever exposed. The
 * embedded browser PDF viewer provides page navigation, text selection and
 * its own zoom controls; the toolbar adds app-level zoom, fullscreen and
 * permission-based download.
 */
export default function PdfViewer({ document, canDownload = true, onClose }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [downloading, setDownloading] = useState(false);
  const frameWrapRef = useRef(null);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getDocumentBlob(document.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id]);

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await api.getDocumentBlob(document.id, true);
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.original_name || 'document.pdf';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const fullscreen = async () => {
    try {
      if (!window.document.fullscreenElement) {
        await frameWrapRef.current?.requestFullscreen();
      } else {
        await window.document.exitFullscreen();
      }
    } catch {
      /* fullscreen may be blocked by the browser */
    }
  };

  const openInNewTab = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar no-print">
        <div className="pdf-toolbar-info">
          <Icon name="file" size={16} />
          <strong title={document.original_name}>{document.original_name}</strong>
          <span className="pdf-doc-type">{document.document_type}</span>
        </div>
        <div className="pdf-toolbar-actions">
          <button type="button" className="btn-icon" onClick={() => setZoom((z) => Math.max(50, z - 25))} title="Zoom out">
            <Icon name="zoomOut" size={16} />
          </button>
          <span className="pdf-zoom-value">{zoom}%</span>
          <button type="button" className="btn-icon" onClick={() => setZoom((z) => Math.min(300, z + 25))} title="Zoom in">
            <Icon name="zoomIn" size={16} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setZoom(100)}>Reset</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openInNewTab} disabled={!url}>Open Tab</button>
          <button type="button" className="btn-icon" onClick={fullscreen} title="Fullscreen">
            <Icon name="fullscreen" size={16} />
          </button>
          {canDownload && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={download} disabled={downloading}>
              <Icon name="download" size={14} /> {downloading ? 'Downloading...' : 'Download'}
            </button>
          )}
          {onClose && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          )}
        </div>
      </div>

      {error && <div className="login-error" style={{ margin: 12 }}>{error}</div>}
      {loading && <div className="loading">Loading PDF...</div>}

      <div className="pdf-frame-wrap" ref={frameWrapRef}>
        {url && (
          <iframe
            title={document.original_name || 'PDF document'}
            src={`${url}#toolbar=1&navpanes=0&view=FitH`}
            className="pdf-frame"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          />
        )}
      </div>
      <p className="pdf-hint">
        Use the PDF toolbar inside the frame for page navigation, or the buttons above for zoom,
        fullscreen and download. Files are streamed securely and are never given a public URL.
      </p>
    </div>
  );
}
