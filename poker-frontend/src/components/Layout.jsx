import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import "./Layout.css";

export function Layout({ title, subtitle, ctaLabel, ctaIcon, onCta, children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-layout-column">
        {title && <TopHeader title={title} subtitle={subtitle} ctaLabel={ctaLabel} ctaIcon={ctaIcon} onCta={onCta} />}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
