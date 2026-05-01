import { mergeClasses, Body1Stronger } from '@fluentui/react-components';
import { usePanelStyles } from './styles';

export default function Panel({ title, headerExtra, headerVariant, children }) {
  const styles = usePanelStyles();
  return (
    <div className={styles.panel}>
      <div className={mergeClasses(
        styles.panelHeader,
        headerVariant === 'converted' && styles.panelHeaderConverted,
      )}>
        <Body1Stronger>{title}</Body1Stronger>
        {headerExtra}
      </div>
      <div className={styles.panelBody}>{children}</div>
    </div>
  );
}
