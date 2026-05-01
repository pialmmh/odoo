// Generic Fluent v9 detail-page layout used by Lead/Contact/Account/Opp/Case.
// Caller supplies: header (icon, breadcrumb, title, subtitle), actionBar JSX,
// mainPanels array, sidePanels array. All composition-based; no config soup.

import { Caption1, Subtitle1, Link as FluentLink, tokens } from '@fluentui/react-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDetailStyles } from './styles';

export default function EntityDetailLayout({
  icon, breadcrumbLabel, title, subtitle,
  actionBar,
  mainPanels,
  sidePanels,
}) {
  const styles = useDetailStyles();
  const navigate = useNavigate();
  const location = useLocation();
  // Strip the trailing /:id (or /:id/edit) segment(s) to derive the list path
  // we navigate back to.
  const listPath = location.pathname.replace(/\/[^/]+(\/edit)?$/, '');

  return (
    <div className={styles.page}>
      <div className={styles.headerCard}>
        <div className={styles.headerIcon}>{icon}</div>
        <div className={styles.headerText}>
          <Caption1>
            <FluentLink as="button" onClick={() => navigate(listPath)} className={styles.breadcrumb}>
              {breadcrumbLabel}
            </FluentLink>{' '}›
          </Caption1>
          <Subtitle1>{title}</Subtitle1>
          {subtitle && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{subtitle}</Caption1>}
        </div>
      </div>

      <div className={styles.actionBar}>{actionBar}</div>

      <div className={styles.contentGrid}>
        <div className={styles.mainCol}>{mainPanels}</div>
        <div className={styles.sideCol}>{sidePanels}</div>
      </div>
    </div>
  );
}
