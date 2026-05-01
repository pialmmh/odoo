import { mergeClasses } from '@fluentui/react-components';
import { useFieldStyles } from './styles';

/** Detail-page field row. label + value, value falls back to "None" when empty. */
export function Field({ label, icon, value, half = true }) {
  const styles = useFieldStyles();
  const empty = value === null || value === undefined || value === '' ||
                (typeof value === 'string' && !value.trim());
  return (
    <div className={half ? styles.fieldHalf : styles.fieldFull}>
      <div className={styles.field}>
        <div className={styles.fieldLabel}>
          {icon}<span>{label}</span>
        </div>
        <div className={mergeClasses(styles.fieldValue, empty && styles.fieldEmpty)}>
          {empty ? 'None' : value}
        </div>
      </div>
    </div>
  );
}

/** 12-col container. Use inside Panel to lay out FieldRows. */
export function FieldGrid({ children }) {
  const styles = useFieldStyles();
  return <div className={styles.fieldGrid}>{children}</div>;
}

/** Italic muted "No Data" placeholder for side panels. */
export function EmptyData({ children = 'No Data' }) {
  const styles = useFieldStyles();
  return <div className={styles.emptySide}>{children}</div>;
}
