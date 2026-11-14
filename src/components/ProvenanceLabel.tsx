import { Archive, Cpu, FlaskConical, Radio } from 'lucide-react';
import type { ProvenanceTier } from '../types/sar';

interface ProvenanceLabelProps {
  tier: ProvenanceTier;
  compact?: boolean;
}

const TIER_CONFIG: Record<
  ProvenanceTier,
  {
    textColor: string;
    borderColor: string;
    Icon: typeof Radio;
    shortLabel: string;
  }
> = {
  'Live Satellite Data': {
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/30',
    Icon: Radio,
    shortLabel: 'Live Satellite',
  },
  'Archived Satellite Data': {
    textColor: 'text-ice-blue',
    borderColor: 'border-ice-blue/30',
    Icon: Archive,
    shortLabel: 'Archived Satellite',
  },
  'Processed Observations': {
    textColor: 'text-crystal-white',
    borderColor: 'border-crystal-white/30',
    Icon: Cpu,
    shortLabel: 'Processed Obs',
  },
  'Sample/Demo Data': {
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/30',
    Icon: FlaskConical,
    shortLabel: 'Sample / Demo',
  },
};

export function ProvenanceLabel({ tier, compact = false }: ProvenanceLabelProps) {
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums ${cfg.textColor} whitespace-nowrap shrink-0`}
      title={`Data Provenance: ${tier}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{compact ? cfg.shortLabel : tier}</span>
    </span>
  );
}
