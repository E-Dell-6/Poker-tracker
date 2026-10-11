import { useState } from 'react';
import {
  Upload, FileText, Link2, Trash2, Mail, Lock, Search, Plus,
  TrendingUp, Layers, Timer, Eye, EyeOff,
} from 'lucide-react';
import { ACCENTS } from '../../styles/accents';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Tag } from '../../components/ui/Tag';
import { StatTile } from '../../components/ui/StatTile';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Menu, MenuAnchor, MenuItem, MenuSeparator } from '../../components/ui/Menu';
import './UiGallery.css';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];
const SIZES = ['sm', 'md', 'lg'];
const SESSIONS = [
  { date: 'Oct 9', stakes: 'NL50', hands: 812, result: 240.5 },
  { date: 'Oct 7', stakes: 'NL25', hands: 1204, result: -85 },
  { date: 'Oct 4', stakes: 'NL50', hands: 640, result: 32.25 },
];

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

// Tag style references - the live Tag (Notion-style) next to three other
// directions, drawn with the same tags so they can be compared directly.
// Only the Notion one is a real component; the others are prototypes that
// exist on this page until one is picked.
const SAMPLE_TAGS = [
  { label: 'Fish', color: '#22c55e' },
  { label: 'Nit', color: '#f59e0b' },
  { label: 'Maniac', color: '#ef4444' },
  { label: 'Reg', color: '#64748b' },
  { label: 'Calls too much', color: '#2563eb' },
  { label: 'Bluffs rivers', color: '#8b5cf6' },
];

const TAG_REFERENCES = [
  { key: 'notion', site: 'Notion', note: 'Muted colour blocks, light text. In use now.' },
  { key: 'trello', site: 'Trello', note: 'Solid, saturated labels; black or white text, whichever reads better.' },
  { key: 'jira', site: 'Jira', note: 'Uppercase bold lozenges on a faint tint, like status labels.' },
  { key: 'edge', site: 'Discord', note: 'Neutral block with a colour edge, like Discord\'s embeds.' },
];

// Black or white, whichever has more contrast on a hex colour.
function readableTextOn(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? '#0a0a0c' : '#ffffff';
}

function ReferenceTag({ style, label, color }) {
  if (style === 'notion') return <Tag label={label} color={color} />;
  return (
    <span
      className={`uig-proto uig-proto--${style}`}
      style={{ '--tag-color': color, '--tag-text': readableTextOn(color) }}
    >
      {label}
    </span>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="uig-section">
      <div>
        <h2 className="uig-section-title">{title}</h2>
        {note && <p className="uig-section-note">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// Dev-only preview of the shared components in components/ui. Served at
// /dev/ui by `npm run dev` and left out of production builds (see the route
// in App.jsx). The accent switch recolours this page only and doesn't touch
// the saved preference - except the modal, which renders at the page root
// and so keeps the saved accent.
export default function UiGallery() {
  const [accent, setAccent] = useState('orange');
  const [range, setRange] = useState('30d');
  const [tableSize, setTableSize] = useState('6');
  const [view, setView] = useState('chart');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(2);
  const [showPassword, setShowPassword] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fakeSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1500);
  };

  return (
    <div className="uig" data-accent={accent}>
      <header className="uig-header">
        <div>
          <h1 className="uig-title">UI components</h1>
          <p className="uig-lead">Everything in components/ui, in each variant. This page only exists in dev.</p>
        </div>
        <Tabs
          variant="segmented"
          size="sm"
          options={ACCENTS}
          active={accent}
          onChange={setAccent}
          aria-label="Preview accent"
        />
      </header>

      <Section title="Buttons" note="One primary per screen. Hover, press, and Tab through to see the focus ring.">
        {SIZES.map((size) => (
          <div className="uig-row" key={size}>
            <span className="uig-label">{size}</span>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} size={size}>{capitalize(variant)}</Button>
            ))}
            <Button size={size} icon={Plus}>With icon</Button>
            <Button size={size} icon={Search} aria-label="Search" />
          </div>
        ))}
        <div className="uig-row">
          <span className="uig-label">states</span>
          <Button variant="primary" loading={saving} onClick={fakeSave}>Save changes</Button>
          <Button loading={saving} onClick={fakeSave}>Recompute stats</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Tabs" note="Pills for filters, segmented for switching views.">
        <div className="uig-row">
          <span className="uig-label">pill</span>
          <Tabs
            options={['7d', '30d', '90d', { key: 'all', label: 'All time' }, { key: 'ytd', label: 'YTD', disabled: true }]}
            active={range}
            onChange={setRange}
          />
        </div>
        <div className="uig-row">
          <span className="uig-label">pill sm</span>
          <Tabs size="sm" options={[{ key: '6', label: '6-max' }, { key: '9', label: '9-max' }]} active={tableSize} onChange={setTableSize} />
        </div>
        <div className="uig-row">
          <span className="uig-label">segment</span>
          <Tabs
            variant="segmented"
            options={[{ key: 'chart', label: 'Chart' }, { key: 'table', label: 'Table' }, { key: 'hands', label: 'Hands' }]}
            active={view}
            onChange={setView}
          />
        </div>
      </Section>

      <Section title="Tags" note="Styled after Notion's select tags: each colour blended into a deep, muted block with light text (5.8:1 or better for every colour in the picker). Plain tags stay grey.">
        <div className="uig-row">
          <span className="uig-label">sm</span>
          {SAMPLE_TAGS.slice(0, 4).map((tag) => <Tag key={tag.label} label={tag.label} color={tag.color} />)}
          <Tag variant="live">LIVE</Tag>
          <Tag variant="positive">BTN +4.2</Tag>
          <Tag variant="negative">SB −12.8</Tag>
          <Tag>NL50</Tag>
        </div>
        <div className="uig-row">
          <span className="uig-label">md</span>
          <Tag size="md" color="#22c55e">Fish</Tag>
          <Tag size="md" color="#2563eb">Calls too much</Tag>
          <Tag size="md">Cash</Tag>
        </div>
      </Section>

      <Section
        title="Tag style references"
        note="Four directions taken from real products, drawn with the same tags. Notion is what the app uses now; say which one you want and it becomes the Tag everywhere."
      >
        <div className="uig-grid uig-grid--wide">
          {TAG_REFERENCES.map((ref) => (
            <Card key={ref.key}>
              <CardHeader title={ref.site} subtitle={ref.note} titleAs="h3" />
              <div className="uig-ref-row">
                <span className="uig-ref-name">FishyMcFish</span>
                <span className="uig-ref-tags">
                  {SAMPLE_TAGS.slice(0, 2).map((tag) => <ReferenceTag key={tag.label} style={ref.key} {...tag} />)}
                </span>
              </div>
              <div className="uig-ref-cloud">
                {SAMPLE_TAGS.map((tag) => <ReferenceTag key={tag.label} style={ref.key} {...tag} />)}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Stat tiles" note="Tiles narrower than 190px step the value down to 24px.">
        <div className="uig-grid">
          <StatTile label="Net profit" value="$4,820.50" valueClassName="pos" delta="+12% vs last month" deltaPositive icon={TrendingUp} />
          <StatTile label="bb/100" value="6.4" valueClassName="accent" delta="Last 30 days" icon={Layers} />
          <StatTile label="Hands" value="48,210" icon={Layers} />
          <StatTile label="Session time" value="126h" delta="−3h vs last month" deltaPositive={false} icon={Timer} />
        </div>
      </Section>

      <Section title="Cards">
        <div className="uig-grid uig-grid--wide">
          <Card>
            <CardHeader
              title="Recent sessions"
              subtitle="Your last 5 sessions"
              actions={<Button variant="ghost" size="sm">View all</Button>}
            />
            <p className="uig-text">Cards group related content: surface-1, a 1px border, no shadow at rest.</p>
          </Card>
          <Card as="button" type="button" interactive>
            <CardHeader title="Clickable card" subtitle="Hover or Tab to it" />
            <p className="uig-text">Interactive cards lift on hover and show the focus ring from the keyboard.</p>
          </Card>
        </div>
      </Section>

      <Section title="Form fields" note="16px text, a hint or an error under each field, and a focus halo in the accent.">
        <div className="uig-form">
          <Field label="Email" hint="We'll only use it to sign you in.">
            <Input type="email" icon={Mail} placeholder="you@example.com" />
          </Field>
          <Field
            label="Password"
            aside={<button type="button" className="uig-link">Forgot password?</button>}
          >
            <Input
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              placeholder="Your password"
              trailing={(
                <Button
                  variant="ghost"
                  size="sm"
                  icon={showPassword ? EyeOff : Eye}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                />
              )}
            />
          </Field>
          <Field label="Buy-in" error="Enter an amount above 0">
            <Input inputMode="decimal" defaultValue="-20" />
          </Field>
          <Field label="Stakes">
            <Select defaultValue="NL50">
              <option>NL10</option>
              <option>NL25</option>
              <option>NL50</option>
              <option>NL100</option>
            </Select>
          </Field>
          <Field label="Disabled">
            <Input disabled value="Locked while saving" readOnly />
          </Field>
          <Field label="Small (toolbars)">
            <Input size="sm" icon={Search} placeholder="Search hands" />
          </Field>
        </div>
      </Section>

      <Section title="Table and pagination">
        <Table>
          <TableHead>
            <TableCell header>Date</TableCell>
            <TableCell header>Stakes</TableCell>
            <TableCell header align="right">Hands</TableCell>
            <TableCell header align="right">Result</TableCell>
          </TableHead>
          <TableBody>
            {SESSIONS.map((s) => (
              <TableRow key={s.date} onClick={() => {}}>
                <TableCell>{s.date}</TableCell>
                <TableCell><Tag variant="neutral">{s.stakes}</Tag></TableCell>
                <TableCell align="right"><span className="ui-table-value-mono">{s.hands.toLocaleString()}</span></TableCell>
                <TableCell align="right">
                  <span className={`ui-table-value-mono ${s.result >= 0 ? 'pos' : 'neg'}`}>
                    {s.result >= 0 ? '+' : '−'}${Math.abs(s.result).toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={5} onPageChange={setPage} />
      </Section>

      <Section title="Overlays" note="Escape closes either one; focus goes back to the button that opened it.">
        <div className="uig-row">
          <Button variant="primary" icon={Plus} onClick={() => setModalOpen(true)}>Add player</Button>
          <MenuAnchor>
            <Button
              icon={Upload}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              Import
            </Button>
            <Menu open={menuOpen} onClose={() => setMenuOpen(false)} aria-label="Import options">
              <MenuItem icon={Upload} description="CSV or hand-history files">Upload files</MenuItem>
              <MenuItem icon={FileText}>Paste a hand</MenuItem>
              <MenuItem icon={Link2} description="Coming soon" disabled>Connect a site</MenuItem>
              <MenuSeparator />
              <MenuItem icon={Trash2} danger>Clear imports</MenuItem>
            </Menu>
          </MenuAnchor>
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add player"
        description="Players you add can be tagged and linked to hands."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Add player</Button>
          </>
        )}
      >
        <div className="uig-modal-fields">
          <Field label="Name">
            <Input placeholder="e.g. FishyMcFish" />
          </Field>
          <Field label="Site" hint="Where you usually play them.">
            <Select defaultValue="gg">
              <option value="gg">GGPoker</option>
              <option value="acr">ACR</option>
              <option value="live">Live</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
