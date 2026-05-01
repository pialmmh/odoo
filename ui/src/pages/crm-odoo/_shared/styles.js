// Shared makeStyles for the Fluent-v9 CRM clone (Lead, Contact, Account,
// Opportunity, Case, …). All tokens, no raw px or hex.
//
// Used by: EntityDetailLayout, Panel, FieldRow, EntityList, EntityDialog.

import { makeStyles, tokens } from '@fluentui/react-components';

export const useDetailStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },

  headerCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalL,
  },
  headerIcon: {
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  breadcrumb: { color: tokens.colorBrandForeground1 },

  actionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalL,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  btnGroup: { display: 'inline-flex', alignItems: 'center', columnGap: tokens.spacingHorizontalS },

  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalL,
  },
  mainCol: {
    gridColumn: 'span 8',
    '@media (max-width: 1023px)': { gridColumn: 'span 12' },
  },
  sideCol: {
    gridColumn: 'span 4',
    '@media (max-width: 1023px)': { gridColumn: 'span 12' },
  },
});

export const usePanelStyles = makeStyles({
  panel: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflow: 'hidden',
    marginBottom: tokens.spacingVerticalL,
  },
  panelHeader: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelBody: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  panelHeaderConverted: {
    borderTop: `2px solid ${tokens.colorPaletteGreenBorderActive}`,
  },
});

export const useFieldStyles = makeStyles({
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalM,
  },
  fieldHalf: {
    gridColumn: 'span 6',
    '@media (max-width: 639px)': { gridColumn: 'span 12' },
  },
  fieldFull: { gridColumn: 'span 12' },
  field: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.04em',
  },
  fieldValue: {
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    marginTop: tokens.spacingVerticalXS,
    overflowWrap: 'anywhere',
  },
  fieldEmpty: { color: tokens.colorNeutralForeground4 },
  emptySide: {
    color: tokens.colorNeutralForeground4,
    fontStyle: 'italic',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
  },
});

export const useListStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalM,
    flexWrap: 'wrap',
  },
  toolbarLeft: { display: 'flex', alignItems: 'baseline', columnGap: tokens.spacingHorizontalM },
  toolbarRight: { display: 'flex', alignItems: 'center', columnGap: tokens.spacingHorizontalS },

  filters: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },

  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflow: 'hidden',
    /* Inflate every row in the list to ~52 px so the table breathes — the
       default Fluent <Table size="small"> rows are too tight. */
    '& tbody tr td': {
      paddingTop: tokens.spacingVerticalM,
      paddingBottom: tokens.spacingVerticalM,
    },
    /* Header row a touch shorter so it stays distinct. */
    '& thead tr th': {
      paddingTop: tokens.spacingVerticalS,
      paddingBottom: tokens.spacingVerticalS,
    },
  },
  rowLink: {
    cursor: 'pointer',
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    background: 'none',
    border: 'none',
    padding: 0,
    textAlign: 'left',
    ':hover': { textDecoration: 'underline' },
  },
  rowSubtext: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXXS,
  },
  empty: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
});

export const useDialogStyles = makeStyles({
  surface: { maxWidth: '880px', width: '100%' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXL,
    width: '100%',
    boxSizing: 'border-box',
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
  },
  span2:  { gridColumn: 'span 2',
            '@media (max-width: 1023px)': { gridColumn: 'span 6'  },
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span3:  { gridColumn: 'span 3',
            '@media (max-width: 1023px)': { gridColumn: 'span 6'  },
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span4:  { gridColumn: 'span 4',
            '@media (max-width: 1023px)': { gridColumn: 'span 6'  },
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span5:  { gridColumn: 'span 5',
            '@media (max-width: 1023px)': { gridColumn: 'span 6'  },
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span6:  { gridColumn: 'span 6',
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span12: { gridColumn: 'span 12' },
  actions: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    paddingBottom: tokens.spacingVerticalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: tokens.spacingVerticalL,
    columnGap: tokens.spacingHorizontalS,
    '@media (max-width: 639px)': {
      flexDirection: 'column',
      '& > button': { width: '100%' },
    },
  },
});
