import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Search } from 'lucide-react';
import { Button } from '../src/components/ui/Button.jsx';
import { Tabs } from '../src/components/ui/Tabs.jsx';
import { Tag } from '../src/components/ui/Tag.jsx';
import { Field } from '../src/components/ui/Field.jsx';
import { Input } from '../src/components/ui/Input.jsx';
import { Select } from '../src/components/ui/Select.jsx';
import { Modal } from '../src/components/ui/Modal.jsx';
import { Menu, MenuAnchor, MenuItem } from '../src/components/ui/Menu.jsx';

describe('Button', () => {
  it('is type="button" unless told otherwise', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('keeps its label but blocks clicks while loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('becomes a square icon button when it has no label', () => {
    render(<Button icon={Search} aria-label="Search" />);
    expect(screen.getByRole('button', { name: 'Search' })).toHaveClass('ui-btn--icon-only');
  });
});

describe('Tabs', () => {
  it('marks the selected option pressed and active', async () => {
    const onChange = vi.fn();
    render(<Tabs options={['7d', '30d']} active="30d" onChange={onChange} />);
    expect(screen.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30d' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: '7d' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });
});

describe('Tag', () => {
  it('puts a picked colour in the dot only, leaving the text neutral', () => {
    render(<Tag label="Fish" color="#22c55e" />);
    const tag = screen.getByText('Fish');
    expect(tag).not.toHaveAttribute('style');
    expect(tag.querySelector('.ui-tag-dot')).toHaveStyle({ background: '#22c55e' });
  });

  it('draws a dot for semantic variants but not for neutral tags', () => {
    render(
      <>
        <Tag variant="live">LIVE</Tag>
        <Tag>NL50</Tag>
      </>
    );
    expect(screen.getByText('LIVE').querySelector('.ui-tag-dot')).toBeInTheDocument();
    expect(screen.getByText('NL50').querySelector('.ui-tag-dot')).not.toBeInTheDocument();
  });
});

describe('Field', () => {
  it('labels the control and links the hint', () => {
    render(
      <Field label="Email" hint="We never share it">
        <Input type="email" />
      </Field>
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We never share it');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('swaps the hint for the error and marks the control invalid', () => {
    render(
      <Field label="Email" hint="We never share it" error="Invalid email">
        <Input type="email" />
      </Field>
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('Invalid email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.closest('.ui-control')).toHaveClass('is-invalid');
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument();
  });

  it('wires a Select the same way', () => {
    render(
      <Field label="Stakes" error="Pick a stake">
        <Select>
          <option>NL50</option>
        </Select>
      </Field>
    );
    const select = screen.getByLabelText('Stakes');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAccessibleDescription('Pick a stake');
    expect(select).toHaveAttribute('aria-invalid', 'true');
  });
});

function ModalHarness({ dismissible = true, onClose = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <Modal
        open={open}
        onClose={() => { onClose(); setOpen(false); }}
        title="Add player"
        dismissible={dismissible}
        footer={<Button>Cancel</Button>}
      >
        <Field label="Name">
          <Input />
        </Field>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<ModalHarness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens named by its title, with focus on the first field', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Add player' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('closes on Escape and gives focus back to the opener', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes when the scrim is clicked', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(document.querySelector('.ui-modal-scrim'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores Escape and the scrim, and hides the close button, when not dismissible', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalHarness dismissible={false} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    await user.click(document.querySelector('.ui-modal-scrim'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    // Tab order inside: Close (header), Name, Cancel (footer).
    screen.getByRole('button', { name: 'Cancel' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('closes only the top modal on Escape', async () => {
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(false);
      return (
        <Modal open={outer} onClose={() => setOuter(false)} title="Outer">
          <button type="button" onClick={() => setInner(true)}>Open inner</button>
          <Modal open={inner} onClose={() => setInner(false)} title="Inner">
            <p>Inner body</p>
          </Modal>
        </Modal>
      );
    }
    const user = userEvent.setup();
    render(<Nested />);
    await user.click(screen.getByRole('button', { name: 'Open inner' }));
    expect(screen.getByRole('dialog', { name: 'Inner' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Inner' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeInTheDocument();
  });
});

function MenuHarness({ onSelect = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MenuAnchor>
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Import
        </button>
        <Menu open={open} onClose={() => setOpen(false)} aria-label="Import options">
          <MenuItem onSelect={onSelect}>Upload files</MenuItem>
          <MenuItem disabled>Connect a site</MenuItem>
          <MenuItem>Paste a hand</MenuItem>
        </Menu>
      </MenuAnchor>
      <button type="button">Elsewhere</button>
    </>
  );
}

describe('Menu', () => {
  it('focuses the first item and moves with the arrow keys, skipping disabled items', async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('menuitem', { name: 'Upload files' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Paste a hand' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Upload files' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Paste a hand' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Import' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('runs onSelect and closes when an item is chosen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MenuHarness onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Upload files' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on a click outside, while a click on the trigger just toggles it', async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    const trigger = screen.getByRole('button', { name: 'Import' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // If the trigger's mousedown counted as "outside", the menu would close
    // and the click would reopen it.
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('inside a modal, Escape closes the menu before the modal', async () => {
    function MenuInModal() {
      const [menuOpen, setMenuOpen] = useState(false);
      const [modalOpen, setModalOpen] = useState(true);
      return (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Hand">
          <MenuAnchor>
            <button type="button" aria-haspopup="menu" onClick={() => setMenuOpen(true)}>More</button>
            <Menu open={menuOpen} onClose={() => setMenuOpen(false)}>
              <MenuItem>Share</MenuItem>
            </Menu>
          </MenuAnchor>
        </Modal>
      );
    }
    const user = userEvent.setup();
    render(<MenuInModal />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Hand' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
