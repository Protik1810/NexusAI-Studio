import React, { useEffect, useState } from 'react';
import { Download, Check, Cpu, Loader2, Info } from 'lucide-react';
import { getStarterPacks, StarterPack, parseSizeGB } from '../../services/modelCatalog';

interface StarterPacksProps {
  /** Filenames already present locally, so installed items render as done. */
  installedFilenames: string[];
  onDownloadModel: (url: string, filename: string, targetFolder: string) => Promise<void>;
  onError: (title: string, message: string) => void;
}

/**
 * First-run onboarding.
 *
 * A fresh install has no models, and neither image pipeline can produce
 * anything until the right *combination* of files exists — the standard
 * pipeline needs one all-in-one checkpoint, FLUX needs a diffusion model
 * plus a text encoder plus a VAE, none of which is useful alone. Choosing
 * those by hand off Hugging Face is where most people stall, so this offers
 * a known-good set sized to the detected GPU and drops each file into the
 * folder its pipeline actually reads from.
 */
export const StarterPacks: React.FC<StarterPacksProps> = ({
  installedFilenames,
  onDownloadModel,
  onError
}) => {
  const [vramGB, setVramGB] = useState<number | null>(null);
  const [gpuName, setGpuName] = useState<string>('');
  const [busyId, setBusyId] = useState<string>('');

  useEffect(() => {
    fetch('/api/hardware-info')
      .then(r => r.json())
      .then(d => {
        const gpu = (d.gpus && d.gpus[0]) || {};
        setVramGB(gpu.vramMB ? gpu.vramMB / 1024 : 0);
        setGpuName(d.primaryGpu || gpu.name || 'CPU only');
      })
      // An unreachable probe shouldn't block onboarding — fall back to the
      // low-VRAM packs, which run anywhere (just slower).
      .catch(() => { setVramGB(0); setGpuName('Unknown'); });
  }, []);

  if (vramGB === null) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={18} className="spin" /> Checking your GPU…
      </div>
    );
  }

  const packs = getStarterPacks(vramGB);
  const isInstalled = (filename: string) => installedFilenames.includes(filename);

  const downloadPack = async (pack: StarterPack, includeOptional: boolean) => {
    setBusyId(pack.pipeline);
    try {
      for (const item of pack.items) {
        if (item.optional && !includeOptional) continue;
        if (isInstalled(item.preset.recommendedFilename)) continue;
        await onDownloadModel(
          item.preset.downloadUrl,
          item.preset.recommendedFilename,
          item.preset.targetFolder
        );
      }
    } catch (e) {
      onError('Starter pack failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
        color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px'
      }}>
        <Cpu size={15} color="var(--accent)" />
        <span>
          Sized for <strong style={{ color: 'var(--text-primary)' }}>{gpuName}</strong>
          {vramGB > 0 && <> · {vramGB.toFixed(1)} GB VRAM</>}
          {vramGB > 0 && vramGB < 16 && (
            <> — the fp8 builds are recommended here; the full-precision FLUX stack needs about 16 GB.</>
          )}
          {vramGB >= 16 && <> — enough for the full-precision builds.</>}
          {vramGB === 0 && <> — showing the smallest builds, which run on CPU too.</>}
        </span>
      </div>

      {packs.map(pack => {
        const required = pack.items.filter(i => !i.optional);
        const allDone = required.every(i => isInstalled(i.preset.recommendedFilename));
        const busy = busyId === pack.pipeline;
        const hasOptional = pack.items.some(i => i.optional);

        return (
          <div
            key={pack.pipeline}
            style={{
              background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {pack.title}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {pack.summary} · <strong>{pack.totalGB} GB</strong> total
                </div>
              </div>
              <button
                type="button"
                className="primary-btn"
                disabled={busy || allDone}
                onClick={() => downloadPack(pack, false)}
                style={{ padding: '9px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                {allDone
                  ? <><Check size={14} /> Installed</>
                  : busy
                    ? <><Loader2 size={14} className="spin" /> Downloading…</>
                    : <><Download size={14} /> Get this pack</>}
              </button>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {pack.items.map(item => {
                const done = isInstalled(item.preset.recommendedFilename);
                return (
                  <div
                    key={item.preset.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
                      padding: '7px 10px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      opacity: item.optional ? 0.75 : 1
                    }}
                  >
                    {done
                      ? <Check size={13} color="var(--success, #22c55e)" />
                      : <Download size={13} color="var(--text-secondary)" />}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {item.preset.name}
                    </span>
                    {item.optional && (
                      <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                        optional
                      </span>
                    )}
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                      {item.role} · {item.preset.size}
                    </span>
                  </div>
                );
              })}
            </div>

            {hasOptional && !allDone && (
              <button
                type="button"
                onClick={() => downloadPack(pack, true)}
                disabled={busy}
                style={{
                  marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', fontSize: '12px', padding: 0
                }}
              >
                + include the optional LoRA
                ({(pack.totalGB + pack.items.filter(i => i.optional).reduce((s, i) => s + parseSizeGB(i.preset.size), 0)).toFixed(1)} GB total)
              </button>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          Files download to your models folder and are sorted automatically —
          diffusion models, text encoders, VAEs and LoRAs each land where the
          pipeline looks for them. You can change that folder in Settings.
        </span>
      </div>
    </div>
  );
};
