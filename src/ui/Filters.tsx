import { CalendarBlank, CardsThree, CaretDown, MagnifyingGlass, MapPin, X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { EVENT_DAYS } from '../config';
import { formatDayKey } from '../lib/time';
import { TEMPLATES, isTemplateId, type TemplateId } from '../slides/templates';

interface DropdownProps {
  icon: ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
}

/** Styled like the Figma filter chip; a transparent native <select> on top keeps it accessible. */
function Dropdown({ icon, label, value, options, onChange, disabled, title }: DropdownProps) {
  const current = options.find((o) => o.value === value);
  return (
    <label
      title={title}
      className={`relative flex w-[140px] shrink-0 items-center justify-between rounded-[8px] px-[12px] py-[8px] text-[14px] leading-[1.5] ${
        value ? 'bg-accent-soft text-accent' : 'bg-overlay-subtle text-ink'
      } ${disabled ? 'opacity-50' : 'hover:brightness-95'}`}
    >
      <span className="flex min-w-0 items-center gap-[8px]">
        {icon}
        <span className="truncate">{current && value ? current.label : label}</span>
      </span>
      <CaretDown size={12} weight="fill" />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface Props {
  search: string;
  onSearch: (value: string) => void;
  template: TemplateId | null;
  onTemplate: (value: TemplateId | null) => void;
  day: string | null;
  onDay: (value: string | null) => void;
  room: string | null;
  onRoom: (value: string | null) => void;
  rooms: string[];
}

export function Filters(props: Props) {
  return (
    <div className="flex w-full items-center gap-[8px]">
      <label className="flex max-w-[600px] min-w-0 flex-1 items-center gap-[8px] rounded-[8px] bg-overlay-subtle px-[12px] py-[8px] focus-within:ring-2 focus-within:ring-accent/40">
        <MagnifyingGlass size={16} className="shrink-0" />
        <input
          type="search"
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder="Search by name, speakers, session type, etc."
          className="min-w-0 flex-1 bg-transparent text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink/45 [&::-webkit-search-cancel-button]:hidden"
        />
        {props.search && (
          <button type="button" onClick={() => props.onSearch('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </label>
      <div className="flex items-center gap-[8px]">
        <Dropdown
          icon={<CardsThree size={16} />}
          label="Slide"
          value={props.template ?? ''}
          options={TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(v) => props.onTemplate(isTemplateId(v) ? v : null)}
        />
        <Dropdown
          icon={<CalendarBlank size={16} />}
          label="Day"
          value={props.day ?? ''}
          options={EVENT_DAYS.map((d) => ({ value: d, label: formatDayKey(d) }))}
          onChange={(v) => props.onDay(v || null)}
        />
        <Dropdown
          icon={<MapPin size={16} />}
          label="Room"
          value={props.room ?? ''}
          options={props.rooms.map((r) => ({ value: r, label: r }))}
          onChange={(v) => props.onRoom(v || null)}
          disabled={props.rooms.length === 0}
          title={props.rooms.length === 0 ? 'Room data isn’t in Airtable yet' : undefined}
        />
      </div>
    </div>
  );
}
